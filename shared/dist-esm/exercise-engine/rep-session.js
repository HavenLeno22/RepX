/**
 * Reusable rep state machines.
 *
 * Almost every counted exercise is the same shape: a tracked value (usually a
 * joint angle) that must travel past a "bottom" threshold and back past a "top"
 * threshold to score one repetition. Rather than reimplement that per exercise —
 * and risk seven subtly different, separately-buggy counters — plugins describe
 * their thresholds and form rules declaratively and share this machine.
 *
 * See docs/EXERCISE_ENGINE.md.
 */
import { landmarksVisible, normalize, Smoother } from './geometry';
/**
 * How long the body may go untracked before the in-progress rep is abandoned.
 *
 * Not zero, which is what this used to be. MediaPipe drops a landmark below the
 * confidence floor for a frame or two constantly — an arm crossing the torso, a
 * hand leaving the frame at the top of a jumping jack — and resetting the state
 * machine on the first such frame threw away reps that were physically
 * completed. A third of a second is long enough to ride out those blips and far
 * too short to hide anything: nobody completes a rep off-camera in 330ms.
 */
const TRACKING_GRACE_MS = 330;
/**
 * How long the same continuous-state complaint stays suppressed.
 *
 * "Get your full body in frame" describes a *state*, not an event, so it was
 * previously emitted on every single frame the state held — 30 rejections per
 * second, each one incrementing the player's rejected-rep counter, flooding the
 * socket and making the on-screen coaching flicker. Discrete complaints (a rep
 * that failed a form check, a rep that was too fast) are never suppressed: each
 * of those is a real, separate attempt the player needs told about.
 */
const STATE_REPEAT_MS = 1500;
export class TwoPhaseRepSession {
    config;
    _repCount = 0;
    _phase = 'ready';
    _completion = 0;
    smoother = new Smoother();
    lastRepAt = 0;
    deepestValue = 0;
    deepestCompletion = 0;
    formFailure = null;
    untrackedSince = null;
    lastStateReason = null;
    lastStateReasonAt = 0;
    constructor(config) {
        this.config = config;
    }
    get repCount() {
        return this._repCount;
    }
    get phase() {
        return this._phase;
    }
    /** 0..1 progress into the current rep — drives the on-screen depth meter. */
    get completion() {
        return this._completion;
    }
    reset() {
        this._repCount = 0;
        this._phase = 'ready';
        this._completion = 0;
        this.smoother.reset();
        this.lastRepAt = 0;
        this.deepestValue = this.config.bottomThreshold;
        this.deepestCompletion = 0;
        this.formFailure = null;
        this.untrackedSince = null;
        this.lastStateReason = null;
        this.lastStateReasonAt = 0;
    }
    processFrame(frame, timestampMs) {
        if (!landmarksVisible(frame, this.config.requiredLandmarks)) {
            return this.handleTrackingLoss(timestampMs);
        }
        // Tracking recovered inside the grace window: carry on mid-rep as if the
        // gap never happened, but re-prime the smoother so stale samples from
        // before the gap cannot be averaged against fresh ones.
        if (this.untrackedSince !== null) {
            this.untrackedSince = null;
            this.smoother.reset();
        }
        const raw = this.config.measure(frame);
        const value = this.smoother.push(raw);
        const { bottomThreshold, topThreshold, invert = false } = this.config;
        const atBottom = invert ? value >= bottomThreshold : value <= bottomThreshold;
        const atTop = invert ? value <= topThreshold : value >= topThreshold;
        this._completion = normalize(value, topThreshold, bottomThreshold);
        this.deepestCompletion = Math.max(this.deepestCompletion, this._completion);
        switch (this._phase) {
            case 'ready':
            case 'ascending': {
                if (atBottom) {
                    this.enterBottom(frame, value);
                }
                else if (!atTop) {
                    this._phase = 'descending';
                }
                break;
            }
            case 'descending': {
                if (atBottom) {
                    this.enterBottom(frame, value);
                }
                else if (atTop) {
                    // Returned to the top without ever reaching depth.
                    //
                    // Only call this out if they made a real attempt — past 40% of the
                    // way down. Otherwise every small shift of weight between reps would
                    // fire a "go deeper" nag, which trains people to ignore the coaching
                    // exactly when it matters.
                    const attempted = this.deepestCompletion > 0.4;
                    this._phase = 'ready';
                    this.deepestCompletion = 0;
                    return attempted ? this.reject('So close — go a little deeper') : null;
                }
                break;
            }
            case 'bottom': {
                this.deepestValue = invert
                    ? Math.max(this.deepestValue, value)
                    : Math.min(this.deepestValue, value);
                // Form is judged only on frames the player is actually *at* depth.
                //
                // This phase spans the whole return journey too, and re-checking on the
                // way up meant any rule that is true only at the bottom failed the
                // instant the player started back: a jumping jack was marked "jump your
                // feet out too" because the feet had — correctly — come back together,
                // and a burpee was marked as having no floor contact because the hands
                // had — correctly — left the floor.
                if (atBottom && this.formFailure === null) {
                    this.formFailure = this.runFormChecks(frame);
                }
                if (atTop) {
                    this._phase = 'ready';
                    return this.completeRep(timestampMs);
                }
                break;
            }
        }
        return { type: 'progress', phase: this._phase, completion: this._completion };
    }
    /**
     * Rides out brief losses of tracking, and abandons the rep only once the gap
     * is long enough that what happened during it is genuinely unknown.
     */
    handleTrackingLoss(timestampMs) {
        this.untrackedSince ??= timestampMs;
        if (timestampMs - this.untrackedSince < TRACKING_GRACE_MS) {
            // Hold the current phase and say nothing — this is almost always a
            // one-frame confidence dip, not the player leaving the frame.
            return null;
        }
        this._phase = 'ready';
        this._completion = 0;
        this.deepestCompletion = 0;
        this.formFailure = null;
        this.smoother.reset();
        return this.stateComplaint('Get your full body in frame', timestampMs);
    }
    enterBottom(frame, value) {
        this._phase = 'bottom';
        this.deepestValue = value;
        this.formFailure = this.runFormChecks(frame);
    }
    runFormChecks(frame) {
        for (const check of this.config.formChecks ?? []) {
            if (!check.test(frame))
                return check.reason;
        }
        return null;
    }
    completeRep(timestampMs) {
        this.deepestCompletion = 0;
        if (this.formFailure) {
            const reason = this.formFailure;
            this.formFailure = null;
            return this.reject(reason);
        }
        // Plausibility is a property of the whole cycle, not of how long the player
        // paused at the bottom. An earlier version also required a minimum dwell at
        // the bottom, which penalised exactly the athletes who do these well:
        // a fast, clean jumping jack passes through the overhead position in two
        // frames and was being thrown out as "too fast to be a real rep".
        const minRepMs = this.config.minRepMs ?? 400;
        const tooFast = this.lastRepAt !== 0 && timestampMs - this.lastRepAt < minRepMs;
        // The clock restarts on every completed cycle, counted or not. Restarting it
        // only on counted reps let a machine-gun cadence through at exactly half
        // rate — reject, accept, reject, accept — because each rejected rep left
        // the previous accepted one as the reference point.
        this.lastRepAt = timestampMs;
        if (tooFast)
            return this.reject('Too fast to be a real rep');
        this._repCount += 1;
        return { type: 'rep_counted', quality: this.qualityOfLastRep(), phase: this._phase };
    }
    /**
     * Depth beyond the minimum, as a fraction of the rep's own travel.
     *
     * Scaled by the configured threshold span rather than a fixed constant,
     * because the measures are not in the same units: elbow angle spans ~40
     * degrees between thresholds while hip height spans ~0.25 torso-lengths. A
     * shared constant scored every torso-normalized exercise at the floor value
     * forever, which silently made average-quality meaningless for four of the
     * seven exercises.
     */
    qualityOfLastRep() {
        const { bottomThreshold, topThreshold, invert = false } = this.config;
        const span = Math.abs(bottomThreshold - topThreshold);
        if (span === 0)
            return 1;
        const overshoot = invert
            ? this.deepestValue - bottomThreshold
            : bottomThreshold - this.deepestValue;
        // Reaching the threshold exactly scores 0.75; going half a span deeper is
        // a perfect rep.
        return Math.max(0.6, Math.min(1, 0.75 + (overshoot / span) * 0.5));
    }
    /** Discrete, per-attempt feedback. Never suppressed. */
    reject(reason) {
        this.lastStateReason = null;
        return { type: 'rep_rejected', reason, phase: this._phase };
    }
    /** Continuous-state feedback, rate-limited so it reads as a status, not a stream. */
    stateComplaint(reason, timestampMs) {
        if (this.lastStateReason === reason && timestampMs - this.lastStateReasonAt < STATE_REPEAT_MS) {
            return null;
        }
        this.lastStateReason = reason;
        this.lastStateReasonAt = timestampMs;
        return { type: 'rep_rejected', reason, phase: this._phase };
    }
}
/**
 * Scoring machine for isometric holds (plank). Points accrue with sustained
 * correct form; breaking form pauses accrual rather than resetting the score.
 */
export class HoldSession {
    config;
    _repCount = 0;
    _phase = 'broken';
    _completion = 0;
    accumulatedMs = 0;
    lastTimestamp = null;
    untrackedSince = null;
    lastStateReason = null;
    lastStateReasonAt = 0;
    constructor(config) {
        this.config = config;
    }
    get repCount() {
        return this._repCount;
    }
    get phase() {
        return this._phase;
    }
    get completion() {
        return this._completion;
    }
    reset() {
        this._repCount = 0;
        this._phase = 'broken';
        this._completion = 0;
        this.accumulatedMs = 0;
        this.lastTimestamp = null;
        this.untrackedSince = null;
        this.lastStateReason = null;
        this.lastStateReasonAt = 0;
    }
    processFrame(frame, timestampMs) {
        const previous = this.lastTimestamp;
        this.lastTimestamp = timestampMs;
        if (!landmarksVisible(frame, this.config.requiredLandmarks)) {
            this.untrackedSince ??= timestampMs;
            // A blip in tracking should not break a plank the player is still holding
            // — it just doesn't earn credit for the frames nobody can vouch for.
            if (timestampMs - this.untrackedSince < TRACKING_GRACE_MS)
                return null;
            this._phase = 'broken';
            return this.stateComplaint('Get your full body in frame', timestampMs);
        }
        this.untrackedSince = null;
        for (const check of this.config.formChecks) {
            if (!check.test(frame)) {
                this._phase = 'broken';
                return this.stateComplaint(check.reason, timestampMs);
            }
        }
        this._phase = 'holding';
        this.lastStateReason = null;
        // Guard against a stalled stream inflating the hold with one huge delta.
        const delta = previous === null ? 0 : Math.min(timestampMs - previous, 250);
        this.accumulatedMs += Math.max(0, delta);
        const msPerPoint = this.config.msPerPoint ?? 1000;
        this._completion = this.accumulatedMs / msPerPoint;
        if (this.accumulatedMs >= msPerPoint) {
            this.accumulatedMs -= msPerPoint;
            this._repCount += 1;
            this._completion = 0;
            return { type: 'rep_counted', quality: 1, phase: this._phase };
        }
        return { type: 'progress', phase: this._phase, completion: this._completion };
    }
    stateComplaint(reason, timestampMs) {
        if (this.lastStateReason === reason && timestampMs - this.lastStateReasonAt < STATE_REPEAT_MS) {
            return null;
        }
        this.lastStateReason = reason;
        this.lastStateReasonAt = timestampMs;
        return { type: 'rep_rejected', reason, phase: this._phase };
    }
}
//# sourceMappingURL=rep-session.js.map
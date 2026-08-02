/**
 * The arena.
 *
 * Runs the camera, on-device pose estimation, and a *local* copy of the exercise
 * plugin for instant coaching feedback — while streaming landmarks to the server,
 * which is the only thing that can actually score a rep. When the two disagree,
 * the server always wins. See docs/AI_ENGINE.md and docs/ANTI_CHEAT.md.
 *
 * Camera and model are not started here: `lib/arena.ts` has already brought both
 * up during matchmaking, so this screen paints a live feed on its first frame
 * instead of racing a download against a countdown that is already running.
 */

import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExercise, type ExerciseSession, type Landmark } from '@repx/shared';
import { DepthMeter } from '../components/DepthMeter';
import { Icon } from '../components/Icon';
import { MomentumBar } from '../components/MomentumBar';
import { SPRING } from '../lib/motion';
import { SKELETON, attachCamera, compactFrame, toPoseFrame } from '../lib/pose';
import { getLandmarker, getStream, prepareArena, releaseCamera } from '../lib/arena';
import { getSocket } from '../lib/socket';
import { useAuth } from '../store/auth';
import { serverTime, useMatch } from '../store/match';

type Stage = 'loading' | 'countdown' | 'live' | 'error';

/**
 * Landmark frames sent per second.
 *
 * The render loop runs at the display's refresh rate, which on a 120Hz phone is
 * four times the rate the pose model produces genuinely new information. Every
 * one of those extra frames was a full 33-landmark socket message. Capping the
 * outbound rate leaves detection and the on-screen skeleton running at full
 * speed while cutting the uplink to what the server can actually use.
 */
const STREAM_FPS = 24;
const STREAM_INTERVAL_MS = 1000 / STREAM_FPS;

export function Match() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const info = useMatch((s) => s.info);
  const phase = useMatch((s) => s.phase);
  const myReps = useMatch((s) => s.myReps);
  const opponentReps = useMatch((s) => s.opponentReps);
  const feedback = useMatch((s) => s.feedback);
  const repPulse = useMatch((s) => s.repPulse);
  const startsAt = useMatch((s) => s.startsAt);
  const endsAt = useMatch((s) => s.endsAt);
  const opponentGone = useMatch((s) => s.opponentDisconnected);

  const [stage, setStage] = useState<Stage>('loading');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [localPhase, setLocalPhase] = useState('ready');
  const [depth, setDepth] = useState(0);
  const [tracking, setTracking] = useState(false);

  const rafRef = useRef<number | null>(null);
  const seqRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const lastSentAtRef = useRef(0);
  const sessionRef = useRef<ExerciseSession | null>(null);
  const liveRef = useRef(false);

  const plugin = info ? getExercise(info.exerciseSlug) : undefined;

  useEffect(() => {
    liveRef.current = phase === 'active';
  }, [phase]);

  /* ------------------------------------------------- camera + model boot -- */

  const renderLoop = useCallback((landmarker: PoseLandmarker) => {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      // The model only has new information when the camera has a new frame.
      if (video.currentTime === lastVideoTimeRef.current) return;
      lastVideoTimeRef.current = video.currentTime;

      const result = landmarker.detectForVideo(video, performance.now());
      const frame = toPoseFrame(result);

      drawOverlay(canvas, video, frame);
      setTracking(frame !== null);
      if (!frame) return;

      // Local session: instant coaching + depth gauge. Never scores the match.
      const session = sessionRef.current;
      if (session) {
        session.processFrame(frame, Date.now());
        setLocalPhase(session.phase);
        setDepth(session.completion);
      }

      // Stream to the server, which independently re-derives the real count.
      if (!liveRef.current) return;
      const now = performance.now();
      if (now - lastSentAtRef.current < STREAM_INTERVAL_MS) return;
      lastSentAtRef.current = now;

      getSocket()?.emit('match:landmarks', {
        matchId: useMatch.getState().info?.matchId,
        frameSeq: seqRef.current++,
        clientTimestamp: Date.now(),
        landmarks: compactFrame(frame),
      });
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!info) {
      navigate('/play');
      return;
    }

    let cancelled = false;
    sessionRef.current = getExercise(info.exerciseSlug)?.createSession() ?? null;
    seqRef.current = 0;
    lastVideoTimeRef.current = -1;

    (async () => {
      try {
        // Normally both of these are already live and this resolves instantly.
        // The await is here for the one case it does not: a reload straight
        // into a match, where nothing was prepared.
        await prepareArena();
        if (cancelled) return;

        const video = videoRef.current;
        const stream = getStream();
        const landmarker = getLandmarker();
        if (!video || !stream || !landmarker) throw new Error('Arena is not ready');

        await attachCamera(video, stream);
        if (cancelled) return;

        setStage('countdown');
        renderLoop(landmarker);
      } catch (err) {
        if (cancelled) return;
        setStage('error');
        setError(err instanceof Error ? err.message : 'Could not start the arena.');
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.matchId]);

  /** Hand the camera back when the arena is left for any reason. */
  useEffect(() => releaseCamera, []);

  /* ----------------------------------------------------------- timers -- */

  useEffect(() => {
    if (phase === 'active') setStage((s) => (s === 'error' ? s : 'live'));
  }, [phase]);

  // Both clocks read from the server's timeline rather than a local countdown
  // started whenever this screen happened to mount.
  useEffect(() => {
    if (startsAt === null) return;
    const update = () => setCountdown(Math.max(0, Math.ceil((startsAt - serverTime()) / 1000)));
    update();
    const id = setInterval(update, 120);
    return () => clearInterval(id);
  }, [startsAt]);

  useEffect(() => {
    if (!endsAt) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((endsAt - serverTime()) / 1000)));
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!info || !user) return null;

  const urgent = remaining <= 10 && remaining > 0;
  const clock = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;

  return (
    <div className="arena">
      <video ref={videoRef} playsInline muted className="arena__video" />
      <canvas ref={canvasRef} className="arena__canvas" />
      <div className="arena__scrim" />

      {/* ------------------------------------------------- top: momentum -- */}
      <div className="arena__top">
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <motion.div key={repPulse} animate={{ scale: [1.012, 1] }} transition={{ duration: 0.22 }}>
            <MomentumBar
              you={{ username: user.username, avatarUrl: user.avatarUrl, reps: myReps }}
              them={{ username: info.opponent.username, avatarUrl: info.opponent.avatarUrl, reps: opponentReps }}
            />
          </motion.div>

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <motion.span
              animate={urgent ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={{ duration: 1, repeat: urgent ? Infinity : 0 }}
              className={`glass arena__clock${urgent ? ' arena__clock--urgent' : ''}`}
            >
              {clock}
            </motion.span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ left: depth -- */}
      {stage === 'live' && plugin?.scoring === 'reps' && (
        <div style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)' }}>
          <DepthMeter completion={depth} label="Depth" />
        </div>
      )}

      {/* ------------------------------------------------------ feedback -- */}
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(var(--safe-b) + 84px)',
          left: 0,
          right: 0,
          textAlign: 'center',
          padding: '0 20px',
        }}
      >
        <AnimatePresence mode="wait">
          {feedback ? (
            <motion.div
              key={feedback}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="glass glass--bad"
            >
              {feedback}
            </motion.div>
          ) : stage === 'live' ? (
            <motion.div
              key={tracking ? localPhase : 'notracking'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`glass${tracking ? '' : ' glass--warn'}`}
              style={{ textTransform: 'capitalize' }}
            >
              {tracking ? localPhase : 'Step back — full body in frame'}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* -------------------------------------------------------- actions -- */}
      <div className="arena__bottom">
        <button
          className="glass glass--bad"
          onClick={() => getSocket()?.emit('match:leave', { matchId: info.matchId })}
        >
          <Icon name="x" size={15} />
          Forfeit
        </button>
      </div>

      {/* ------------------------------------------------------- overlays -- */}
      <AnimatePresence>
        {stage === 'loading' && (
          <Overlay key="loading">
            <div className="spinner" style={{ width: 26, height: 26, marginBottom: 14, color: 'var(--brand)' }} />
            <div className="t-h2">Opening the arena</div>
          </Overlay>
        )}

        {stage === 'error' && (
          <Overlay key="error">
            <div className="empty__icon" style={{ background: 'var(--bad-wash)', color: 'var(--bad)' }}>
              <Icon name="camera" size={26} />
            </div>
            <div className="t-h2">Camera unavailable</div>
            <p
              className="t-sm"
              style={{ marginTop: 8, maxWidth: 380, color: 'var(--on-media-3)', fontWeight: 500 }}
            >
              {error}
            </p>
            <button className="btn btn--ghost" style={{ marginTop: 18 }} onClick={() => navigate('/play')}>
              Back to lobby
            </button>
          </Overlay>
        )}

        {stage === 'countdown' && (
          <Overlay key="countdown">
            <span className={`glass${tracking ? ' glass--ok' : ' glass--warn'}`}>
              <Icon name={tracking ? 'check-circle' : 'info'} size={15} />
              {tracking ? 'Body detected' : 'Step back — full body in frame'}
            </span>

            {/*
              The countdown springs in per digit. It is the moment the match
              becomes real, and a number that simply swaps reads as a clock
              rather than as a start.
            */}
            <motion.div
              key={countdown}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING}
              className="num"
              style={{
                fontSize: 92,
                lineHeight: 1,
                margin: '14px 0 6px',
                letterSpacing: -5,
                color: countdown > 0 ? 'var(--on-media)' : 'var(--brand)',
              }}
            >
              {countdown > 0 ? countdown : 'GO'}
            </motion.div>

            <div style={{ width: 'min(480px, 88vw)', marginTop: 10 }}>
              <MomentumBar
                compact
                you={{ username: user.username, avatarUrl: user.avatarUrl, reps: 0 }}
                them={{ username: info.opponent.username, avatarUrl: info.opponent.avatarUrl, reps: 0 }}
              />
            </div>

            {info.mode === 'ranked' && (
              <div className="row" style={{ gap: 8, marginTop: 18 }}>
                <span className="chip chip--ok">+{info.stakes.win}</span>
                <span className="chip chip--bad">{info.stakes.loss}</span>
              </div>
            )}
          </Overlay>
        )}

        {opponentGone && stage === 'live' && (
          <motion.div
            key="gone"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass glass--warn"
            style={{ position: 'absolute', top: 150, left: '50%', transform: 'translateX(-50%)' }}
          >
            Opponent disconnected
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="overlay"
    >
      {children}
    </motion.div>
  );
}

/** Draws the tracked skeleton so the player can see they're being read correctly. */
function drawOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  frame: Landmark[] | null,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!frame) return;

  const px = (i: number) => ({ x: frame[i].x * canvas.width, y: frame[i].y * canvas.height });

  ctx.lineWidth = Math.max(3, canvas.width * 0.0045);
  // Electric Lime, matching `--you`. Canvas cannot read a CSS custom property,
  // so this is the one literal in the frontend — and it is the palette's, not a
  // new colour. Blue is always you, red is always them held everywhere else;
  // here you are drawn in the brand colour for the same reason the momentum bar
  // is: your own body on screen should be the thing the eye finds first.
  ctx.strokeStyle = 'rgba(182, 255, 59, 0.92)';
  ctx.lineCap = 'round';

  for (const [a, b] of SKELETON) {
    if (!frame[a] || !frame[b]) continue;
    if (frame[a].visibility < 0.35 || frame[b].visibility < 0.35) continue;
    const pa = px(a);
    const pb = px(b);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  const radius = Math.max(3.5, canvas.width * 0.005);
  for (const index of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    const lm = frame[index];
    if (!lm || lm.visibility < 0.35) continue;
    const p = px(index);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

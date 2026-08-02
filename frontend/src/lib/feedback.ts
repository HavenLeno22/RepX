/**
 * Sound and haptics.
 *
 * Neither is *implemented* here — there are no audio files in the repository yet
 * and the web has no haptics API worth the name outside `navigator.vibrate`.
 * What this module does is make both **addressable**: every moment in the
 * product that deserves feedback already calls `cue()`, so shipping sound later
 * is adding files to one map rather than hunting through forty components for
 * the places a click happens.
 *
 * That ordering matters. Retrofitting feedback into a finished interface is how
 * you end up with sound on the three buttons someone remembered and silence on
 * the rest.
 *
 * Haptics work today on Android Chrome; iOS Safari ignores `vibrate`, so the
 * calls are harmless no-ops there until the app is wrapped natively.
 */

import { usePrefs } from '../store/prefs';

/** Every feedback moment in RepX. Adding one here is how it becomes designable. */
export type Cue =
  | 'tap' // any button press
  | 'select' // a choice made: exercise, filter, tab
  | 'toggle'
  | 'nav' // a page transition
  | 'countdown' // each tick of 3-2-1
  | 'match-found'
  | 'rep' // a rep counted
  | 'rep-rejected'
  | 'victory'
  | 'defeat'
  | 'xp'
  | 'level-up'
  | 'promotion'
  | 'demotion'
  | 'achievement'
  | 'mission-complete'
  | 'notification'
  | 'error';

/** Haptic strength, named the way the platform APIs name it. */
type Haptic = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/** Milliseconds pattern per strength. A single short pulse for light; a
 *  two-beat for success; a longer, spaced pattern for error, which needs to be
 *  distinguishable without looking at the screen. */
const HAPTIC_PATTERNS: Record<Haptic, number | number[]> = {
  light: 8,
  medium: 16,
  heavy: 28,
  success: [12, 40, 20],
  warning: [18, 60, 18],
  error: [26, 50, 26, 50, 26],
};

interface CueSpec {
  haptic?: Haptic;
  /** Filename this cue will play once audio ships. Named, not loaded. */
  sound?: string;
}

const CUES: Record<Cue, CueSpec> = {
  tap: { haptic: 'light', sound: 'tap.mp3' },
  select: { haptic: 'light', sound: 'select.mp3' },
  toggle: { haptic: 'light', sound: 'toggle.mp3' },
  nav: { haptic: 'light' },
  countdown: { haptic: 'medium', sound: 'countdown.mp3' },
  'match-found': { haptic: 'heavy', sound: 'match-found.mp3' },
  rep: { haptic: 'light', sound: 'rep.mp3' },
  'rep-rejected': { haptic: 'warning', sound: 'rep-rejected.mp3' },
  victory: { haptic: 'success', sound: 'victory.mp3' },
  defeat: { haptic: 'medium', sound: 'defeat.mp3' },
  xp: { sound: 'xp.mp3' },
  'level-up': { haptic: 'success', sound: 'level-up.mp3' },
  promotion: { haptic: 'success', sound: 'promotion.mp3' },
  demotion: { haptic: 'warning', sound: 'demotion.mp3' },
  achievement: { haptic: 'success', sound: 'achievement.mp3' },
  'mission-complete': { haptic: 'success', sound: 'mission-complete.mp3' },
  notification: { haptic: 'light', sound: 'notification.mp3' },
  error: { haptic: 'error', sound: 'error.mp3' },
};

/**
 * Fire a feedback cue. Safe to call from anywhere, including during a render's
 * event handlers, and safe to call on a platform that supports neither channel.
 */
export function cue(name: Cue): void {
  const spec = CUES[name];
  if (!spec) return;

  const prefs = usePrefs.getState();

  if (prefs.haptics && spec.haptic && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(HAPTIC_PATTERNS[spec.haptic]);
    } catch {
      // A browser that exposes vibrate but refuses it (user gesture rules,
      // battery saver) is not an error worth surfacing.
    }
  }

  if (prefs.sound && spec.sound) playSound(spec.sound);
}

/* ------------------------------------------------------------------ sound -- */

const cache = new Map<string, HTMLAudioElement>();

/**
 * Plays a cue's sound if the file exists.
 *
 * Deliberately fails silently. `assets/sound/` is empty today; when it is
 * populated this starts working with no other change, and until then a missing
 * file must not throw inside a click handler.
 */
function playSound(file: string): void {
  try {
    let audio = cache.get(file);
    if (!audio) {
      audio = new Audio(`/sound/${file}`);
      audio.preload = 'auto';
      audio.volume = 0.35;
      cache.set(file, audio);
    }
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  } catch {
    // no-op
  }
}

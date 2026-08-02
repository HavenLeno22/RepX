/**
 * User preferences that change how the interface behaves rather than what it
 * shows.
 *
 * This replaces the old light/dark theme store. RepX is dark-only now — see the
 * note at the top of `global.css` — and the setting that a theme toggle was
 * really standing in for is accessibility. So the toggle became three that do
 * real work: motion, contrast, and feedback.
 *
 * All four are applied to `<html>` as data attributes before React mounts, so
 * CSS can respond to them without a single component subscribing to the store.
 */

import { create } from 'zustand';

export type MotionPref = 'system' | 'reduced' | 'full';

export interface Prefs {
  motion: MotionPref;
  highContrast: boolean;
  /** Sound is off by default: a fitness app is frequently opened somewhere
   *  sound would be unwelcome, and an unrequested noise on first launch is the
   *  fastest way to be closed and never reopened. */
  sound: boolean;
  haptics: boolean;
}

const KEY = 'repx.prefs';

const DEFAULTS: Prefs = {
  motion: 'system',
  highContrast: false,
  sound: false,
  haptics: true,
};

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULTS;
  }
}

/** True when animation should be collapsed, from either source. */
export function motionIsReduced(prefs: Prefs): boolean {
  if (prefs.motion === 'reduced') return true;
  if (prefs.motion === 'full') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function apply(prefs: Prefs): void {
  const root = document.documentElement;
  // `full` deliberately does not clear the attribute when the OS asks for
  // reduced motion — the CSS media query still applies. It only stops the app
  // from *adding* a reduction the user did not ask for.
  root.setAttribute('data-motion', prefs.motion === 'reduced' ? 'reduced' : 'normal');
  root.setAttribute('data-contrast', prefs.highContrast ? 'high' : 'normal');
}

interface PrefsState extends Prefs {
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
}

export const usePrefs = create<PrefsState>((set, get) => ({
  ...DEFAULTS,
  set: (key, value) => {
    const next: Prefs = { ...currentPrefs(get()), [key]: value };
    localStorage.setItem(KEY, JSON.stringify(next));
    apply(next);
    set(next);
  },
}));

function currentPrefs(state: PrefsState): Prefs {
  return {
    motion: state.motion,
    highContrast: state.highContrast,
    sound: state.sound,
    haptics: state.haptics,
  };
}

/** Called from main.tsx before first paint. */
export function bootstrapPrefs(): void {
  const prefs = read();
  apply(prefs);
  usePrefs.setState(prefs);
}

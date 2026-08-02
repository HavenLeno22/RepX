/**
 * The player's progression snapshot: level, season, missions, achievement
 * counts, unread notifications.
 *
 * Held in a store rather than fetched per-screen for one reason: the unread
 * badge lives in the navigation chrome, which is mounted on every screen. A
 * per-screen fetch would mean the badge only being right on the screens that
 * happened to ask, and going stale everywhere else.
 *
 * One request backs the whole home screen. The previous build opened it with
 * three waterfalled fetches and rendered three separate skeletons that landed at
 * three separate times, which is what made the app feel like it was assembling
 * itself in front of you.
 */

import { create } from 'zustand';
import type { AchievementProgress, LevelState, MissionState, Season } from '@repx/shared';
import { get } from '../lib/api';

export interface Summary {
  level: LevelState;
  season: Season;
  dayStreak: number;
  missions: { daily: MissionState[]; weekly: MissionState[] };
  unreadNotifications: number;
  achievements: {
    unlocked: number;
    total: number;
    recent: AchievementProgress | null;
    nearest: AchievementProgress | null;
  };
}

interface SummaryState {
  summary: Summary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Locally clears the unread badge so marking-as-read feels instant rather
   *  than waiting on a round trip that has already been decided. */
  clearUnread: () => void;
}

export const useSummary = create<SummaryState>((set, getState) => ({
  summary: null,
  loading: false,
  error: null,

  refresh: async () => {
    if (getState().loading) return;
    set({ loading: true, error: null });
    try {
      set({ summary: await get<Summary>('/users/me/summary'), loading: false });
    } catch {
      set({ loading: false, error: 'Could not load your progress.' });
    }
  },

  clearUnread: () => {
    const summary = getState().summary;
    if (summary) set({ summary: { ...summary, unreadNotifications: 0 } });
  },
}));

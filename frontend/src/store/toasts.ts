/**
 * Transient in-app notifications.
 *
 * Priority comes from the notification's category (see `NOTIFICATION_STYLES` in
 * `@repx/shared`), not from the caller — so a rank promotion cannot be raised
 * quietly by one code path and loudly by another.
 *
 * Stacking is capped at three. Beyond that a stack stops being a set of messages
 * and becomes a wall, and the fourth one is the one nobody reads.
 */

import { create } from 'zustand';
import type { NotificationCategory } from '@repx/shared';
import { cue } from '../lib/feedback';

export interface Toast {
  id: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  href?: string;
}

const MAX_VISIBLE = 3;
const DISMISS_MS = 5200;

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],

  push: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // Oldest falls off the top rather than the newest being dropped: the most
    // recent thing that happened is always the one on screen.
    set({ toasts: [...get().toasts, { ...toast, id }].slice(-MAX_VISIBLE) });

    cue(
      toast.category === 'achievement'
        ? 'achievement'
        : toast.category === 'promotion'
          ? 'promotion'
          : toast.category === 'demotion'
            ? 'demotion'
            : toast.category === 'mission'
              ? 'mission-complete'
              : 'notification',
    );

    setTimeout(() => get().dismiss(id), DISMISS_MS);
  },

  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

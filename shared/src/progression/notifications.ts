/**
 * Notification categories.
 *
 * A notification centre that shows one undifferentiated list is a list nobody
 * opens twice. Category is what lets the UI give a rank promotion a different
 * weight — colour, icon, entrance, and whether it interrupts — from a mission
 * completing, without every producer having to decide its own styling.
 *
 * `tone` maps onto the palette's semantic colours, so a notification can never
 * introduce a colour of its own.
 */

export const NOTIFICATION_CATEGORIES = [
  'promotion',
  'demotion',
  'achievement',
  'mission',
  'season',
  'challenge',
  'tournament',
  'system',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationTone = 'brand' | 'gold' | 'info' | 'danger' | 'neutral';

export interface NotificationStyle {
  icon: string;
  tone: NotificationTone;
  /** Higher interrupts: 2 takes over the screen (promotion), 1 toasts, 0 waits
   *  quietly in the notification centre. */
  priority: 0 | 1 | 2;
}

export const NOTIFICATION_STYLES: Record<NotificationCategory, NotificationStyle> = {
  promotion: { icon: 'chevron-up', tone: 'brand', priority: 2 },
  demotion: { icon: 'chevron-down', tone: 'danger', priority: 1 },
  achievement: { icon: 'trophy', tone: 'gold', priority: 2 },
  mission: { icon: 'target', tone: 'brand', priority: 1 },
  season: { icon: 'calendar', tone: 'info', priority: 1 },
  challenge: { icon: 'swords', tone: 'brand', priority: 1 },
  tournament: { icon: 'medal', tone: 'gold', priority: 1 },
  system: { icon: 'info', tone: 'neutral', priority: 0 },
};

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  /** In-app route this notification acts on, if any. */
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

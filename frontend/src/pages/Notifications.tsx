import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  NOTIFICATION_STYLES,
  type AppNotification,
  type NotificationCategory,
  type NotificationTone,
} from '@repx/shared';
import { Icon, type IconName } from '../components/Icon';
import { Stagger, StaggerItem } from '../components/motion';
import { Empty, ErrorState } from '../components/ui';
import { get, post } from '../lib/api';
import { cue } from '../lib/feedback';
import { useSummary } from '../store/summary';

const TONES: Record<NotificationTone, { fg: string; bg: string }> = {
  brand: { fg: 'var(--brand)', bg: 'var(--brand-wash)' },
  gold: { fg: 'var(--gold)', bg: 'var(--gold-wash)' },
  info: { fg: 'var(--cyan)', bg: 'var(--cyan-wash)' },
  danger: { fg: 'var(--bad)', bg: 'var(--bad-wash)' },
  neutral: { fg: 'var(--text-2)', bg: 'var(--card-2)' },
};

type Group = 'all' | 'competition' | 'rewards' | 'social';

/** Which categories belong to which tab. A notification centre with eight tabs is
 *  a filing cabinet; three groups is a place you actually look. */
const GROUPS: Record<Exclude<Group, 'all'>, NotificationCategory[]> = {
  competition: ['promotion', 'demotion', 'tournament', 'season'],
  rewards: ['achievement', 'mission'],
  social: ['challenge'],
};

/**
 * Notifications.
 *
 * Everything here is something that *happened to the player's standing* — a
 * promotion, a trophy, a mission, a friend. Nothing is marketing, and nothing is
 * a nudge to come back, because the moment a notification centre contains one of
 * those it stops being read.
 *
 * Opening the screen marks everything read. Making someone tap a second button
 * to clear a badge they have already looked at is friction dressed up as
 * control.
 */
export function Notifications() {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState(false);
  const [group, setGroup] = useState<Group>('all');
  const clearUnread = useSummary((s) => s.clearUnread);

  function load() {
    setError(false);
    setItems(null);
    void get<AppNotification[]>('/users/me/notifications')
      .then(setItems)
      .catch(() => setError(true));
  }

  useEffect(load, []);

  useEffect(() => {
    if (!items || items.length === 0) return;
    if (!items.some((n) => !n.readAt)) return;
    void post('/users/me/notifications/read', {}).then(clearUnread).catch(() => undefined);
  }, [items, clearUnread]);

  const shown = useMemo(() => {
    if (!items) return [];
    if (group === 'all') return items;
    const categories = GROUPS[group];
    return items.filter((n) => categories.includes(n.category));
  }, [items, group]);

  const grouped = useMemo(() => groupByDay(shown), [shown]);

  return (
    <>
      <div className="head">
        <span className="head__t">Notifications</span>
        {items && items.length > 0 && <span className="chip">{items.length} total</span>}
      </div>

      <div className="seg" role="group" aria-label="Notification group" style={{ marginBottom: 'var(--s4)' }}>
        {(['all', 'competition', 'rewards', 'social'] as Group[]).map((g) => (
          <button
            key={g}
            className="seg__opt"
            aria-pressed={group === g}
            onClick={() => {
              setGroup(g);
              cue('select');
            }}
          >
            {g[0].toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>

      {error ? (
        <div className="panel">
          <ErrorState message="Could not load your notifications" onRetry={load} />
        </div>
      ) : items === null ? (
        <div className="panel">
          <div className="panel__body col gap-sm">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skeleton" style={{ height: 62, opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        </div>
      ) : shown.length === 0 ? (
        <div className="panel">
          <Empty
            icon="bell"
            title={items.length === 0 ? 'Nothing yet' : 'Nothing in this group'}
            hint={
              items.length === 0
                ? 'Promotions, trophies and missions land here'
                : 'Try another group'
            }
            cta={items.length === 0 ? 'Go earn something' : undefined}
            ctaTo={items.length === 0 ? '/play' : undefined}
          />
        </div>
      ) : (
        <div className="col gap-md">
          {grouped.map(([day, list]) => (
            <div key={day} className="panel">
              <header className="panel__head">
                <span className="panel__title">{day}</span>
              </header>
              <Stagger className="list">
                {list.map((notification, i) => (
                  <StaggerItem key={notification.id} index={i}>
                    <Row notification={notification} />
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Row({ notification }: { notification: AppNotification }) {
  const style = NOTIFICATION_STYLES[notification.category];
  const tone = TONES[style.tone];

  const body = (
    <>
      <span
        className="toast__icon"
        style={{ background: tone.bg, color: tone.fg, width: 38, height: 38 }}
      >
        <Icon name={style.icon as IconName} size={18} />
      </span>
      <span className="listrow__main">
        <span className="listrow__name">{notification.title}</span>
        <span className="listrow__sub" style={{ whiteSpace: 'normal' }}>
          {notification.body}
        </span>
      </span>
      <span className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
        <span className="t-caption mute" style={{ fontSize: 10 }}>
          {relativeTime(notification.createdAt)}
        </span>
        {/* Unread is a lime dot, not a bolder row: a list where half the rows are
            heavier is a list that reads as broken rather than as sorted. */}
        {!notification.readAt && (
          <span
            style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand)' }}
            aria-label="Unread"
          />
        )}
      </span>
    </>
  );

  return notification.href ? (
    <Link to={notification.href} className="listrow">
      {body}
    </Link>
  ) : (
    <div className="listrow">{body}</div>
  );
}

/* ----------------------------------------------------------------- dates -- */

function groupByDay(items: AppNotification[]): [string, AppNotification[]][] {
  const buckets = new Map<string, AppNotification[]>();
  for (const item of items) {
    const label = dayLabel(item.createdAt);
    buckets.set(label, [...(buckets.get(label) ?? []), item]);
  }
  return [...buckets.entries()];
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (same(date, today)) return 'Today';
  if (same(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

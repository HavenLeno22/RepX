import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, PRESENCE_LABELS, type Presence } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { Stagger, StaggerItem } from '../components/motion';
import { Emblem, Empty, ErrorState, Panel } from '../components/ui';
import { api, get, post } from '../lib/api';
import { cue } from '../lib/feedback';
import { useToasts } from '../store/toasts';

interface Friend {
  id: string;
  username: string;
  avatarUrl: string | null;
  rating: number;
  rank: string;
  country: string | null;
  currentStreak: number;
  presence: Presence;
  friendshipId?: string;
}

/** Online first, then by rating. Who is available to play right now is the only
 *  ordering this list is ever consulted for. */
const PRESENCE_RANK: Record<Presence, number> = {
  'in-match': 0,
  queueing: 1,
  online: 2,
  offline: 3,
};

/**
 * Friends.
 *
 * Deliberately not a social network. There is no feed, no profile wall and no
 * suggestions engine — the only job friends do in a competitive product is make
 * the ladder feel populated by people instead of usernames. So this screen
 * answers exactly two questions: who is online right now, and who is waiting on
 * my answer.
 */
export function Friends() {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [requests, setRequests] = useState<Friend[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const pushToast = useToasts((s) => s.push);

  function load() {
    setError(false);
    void Promise.all([get<Friend[]>('/friends'), get<Friend[]>('/friends/requests')])
      .then(([f, r]) => {
        setFriends(f);
        setRequests(r);
      })
      .catch(() => setError(true));
  }

  useEffect(load, []);

  async function accept(friendshipId: string, username: string) {
    setBusy(friendshipId);
    try {
      await post(`/friends/requests/${friendshipId}/accept`);
      pushToast({ category: 'challenge', title: 'Friend added', body: `You and ${username} are now friends.` });
      load();
    } catch {
      pushToast({ category: 'system', title: 'Could not accept that request' });
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string, username: string) {
    setBusy(id);
    try {
      await api(`/friends/${id}`, { method: 'DELETE' });
      setFriends((current) => (current ?? []).filter((f) => f.id !== id));
      pushToast({ category: 'system', title: `Removed ${username}` });
    } catch {
      pushToast({ category: 'system', title: 'Could not remove that friend' });
    } finally {
      setBusy(null);
    }
  }

  const sorted = [...(friends ?? [])].sort(
    (a, b) => PRESENCE_RANK[a.presence] - PRESENCE_RANK[b.presence] || b.rating - a.rating,
  );
  const onlineCount = sorted.filter((f) => f.presence !== 'offline').length;

  return (
    <>
      <div className="head">
        <span className="head__t">Friends</span>
        <span className="head__actions">
          {onlineCount > 0 && (
            <span className="chip chip--ok">
              <span className="chip__dot chip__dot--pulse" />
              {onlineCount} online
            </span>
          )}
          <Link to="/leaderboard" className="btn btn--outline btn--sm">
            <Icon name="search" size={15} />
            Find players
          </Link>
        </span>
      </div>

      <div className="col gap-md">
        {requests && requests.length > 0 && (
          <Panel title={`${requests.length} pending request${requests.length === 1 ? '' : 's'}`} flush>
            <div className="list">
              {requests.map((request) => (
                <div key={request.friendshipId} className="listrow">
                  <Avatar username={request.username} src={request.avatarUrl} size={36} />
                  <span className="listrow__main">
                    <span className="listrow__name">{request.username}</span>
                    <span className="listrow__sub">
                      {request.rank} · {request.rating}
                    </span>
                  </span>
                  <button
                    className="btn btn--primary btn--sm"
                    disabled={busy === request.friendshipId}
                    onClick={() => {
                      cue('tap');
                      void accept(request.friendshipId!, request.username);
                    }}
                  >
                    {busy === request.friendshipId ? (
                      <span className="spinner" style={{ width: 13, height: 13 }} />
                    ) : (
                      'Accept'
                    )}
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <div className="panel">
          <header className="panel__head">
            <span className="panel__title">Your rivals</span>
            {friends && <span className="chip">{friends.length}</span>}
          </header>

          {error ? (
            <ErrorState message="Could not load your friends" onRetry={load} />
          ) : friends === null ? (
            <div className="panel__body col gap-sm">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="skeleton" style={{ height: 58, opacity: 1 - i * 0.14 }} />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <Empty
              icon="users"
              title="No rivals yet"
              hint="A ladder is more fun when you know who is above you"
              cta="Browse the leaderboard"
              ctaTo="/leaderboard"
            />
          ) : (
            <Stagger className="list">
              {sorted.map((friend, i) => (
                <StaggerItem key={friend.id} index={i}>
                  <div className="listrow">
                    <Avatar
                      username={friend.username}
                      src={friend.avatarUrl}
                      size={38}
                      presence={friend.presence}
                    />
                    <span className="listrow__main">
                      <span className="listrow__name">{friend.username}</span>
                      <span className="listrow__sub">
                        {PRESENCE_LABELS[friend.presence]}
                        {friend.currentStreak >= 3 && (
                          <span className="chip chip--warn" style={{ padding: '1px 6px', fontSize: 10.5 }}>
                            <Icon name="flame" size={10} />
                            {friend.currentStreak}
                          </span>
                        )}
                      </span>
                    </span>

                    <Emblem rating={friend.rating} size="sm" glow={false} />
                    <span className="num num-board" style={{ width: 46, textAlign: 'right' }}>
                      {friend.rating}
                    </span>

                    <button
                      className="btn btn--outline btn--sm"
                      disabled={busy === friend.id}
                      onClick={() => {
                        cue('tap');
                        void remove(friend.id, friend.username);
                      }}
                      aria-label={`Remove ${friend.username}`}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>

        {/*
          Direct challenges are not built. Saying so plainly, in the place a
          player would look for it, is better than a disabled button that implies
          it exists — and better than silence, which implies it never will.
        */}
        <Panel title="Coming next">
          <div className="row" style={{ gap: 'var(--s3)', alignItems: 'flex-start' }}>
            <span className="empty__icon" style={{ margin: 0, width: 40, height: 40 }}>
              <Icon name="swords" size={19} />
            </span>
            <span>
              <span style={{ fontWeight: 700, fontSize: 14.5, display: 'block' }}>
                Direct challenges
              </span>
              <span className="t-sm mute">
                Queue into a friend by name instead of waiting for the matchmaker to
                pair you. Until then, queue the same exercise at the same time.
              </span>
            </span>
          </div>
        </Panel>
      </div>
    </>
  );
}

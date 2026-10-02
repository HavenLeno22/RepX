/**
 * The two ways into a match that are not the queue: challenging a named player,
 * and a private room.
 *
 * Both are dialogs rather than screens because neither is a destination — you
 * are on the Play screen, you have already chosen an exercise, and these only
 * change *who* you play. Sending you somewhere else to pick an opponent and then
 * back again would lose the exercise selection and the camera warm-up.
 */

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { MatchMode, PublicUser } from '@repx/shared';
import { get } from '../lib/api';
import { cue } from '../lib/feedback';
import { getSocket } from '../lib/socket';
import { useAuth } from '../store/auth';
import { useLobby } from '../store/lobby';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Empty, Tier } from './ui';

/* --------------------------------------------------------------- shell -- */

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Escape closes. A dialog that can only be dismissed by hitting a specific
  // button is the one people get stuck in.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-scrim" onClick={onClose} role="presentation">
      <motion.div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="panel__head">
          <span className="panel__title">{title}</span>
          <button className="btn btn--icon btn--ghost" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        {children}
      </motion.div>
    </div>
  );
}

/* ----------------------------------------------------------- challenge -- */

export function ChallengeDialog({
  exerciseSlug,
  mode,
  onClose,
}: {
  exerciseSlug: string;
  mode: MatchMode;
  onClose: () => void;
}) {
  const me = useAuth((s) => s.user);
  const outgoing = useLobby((s) => s.outgoing);
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<PublicUser[] | null>(null);

  /**
   * The wait, counted down.
   *
   * This was computed inline during render, with nothing scheduling a re-render
   * — so the challenger was told "They have 45 seconds to answer" and watched it
   * say 45 until the challenge expired underneath them. The incoming prompt had
   * a ticker; the outgoing one did not, which is the side with nothing else to
   * look at.
   */
  const [remaining, setRemaining] = useState(0);
  const expiresAt = outgoing?.expiresAt;
  useEffect(() => {
    if (expiresAt === undefined) return;
    const tick = () => setRemaining(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [expiresAt]);

  // The ladder search doubles as the player directory — there is no second index
  // of people to maintain, and the rating shown is the one that matters.
  useEffect(() => {
    const params = new URLSearchParams({ limit: '12' });
    if (query.trim()) params.set('search', query.trim());

    let cancelled = false;
    const id = setTimeout(() => {
      void get<PublicUser[]>(`/leaderboard?${params}`)
        .then((rows) => {
          if (!cancelled) setPlayers(rows.filter((p) => p.id !== me?.id));
        })
        .catch(() => {
          if (!cancelled) setPlayers([]);
        });
    }, query ? 260 : 0);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, me?.id]);

  function challenge(userId: string) {
    getSocket()?.emit('challenge:send', { toUserId: userId, exerciseSlug, mode });
    cue('select');
  }

  function cancel() {
    if (outgoing) getSocket()?.emit('challenge:decline', { challengeId: outgoing.challengeId });
    useLobby.getState().setOutgoing(null);
  }

  if (outgoing) {
    return (
      <Dialog title="Challenge sent" onClose={onClose}>
        <div className="panel__body col gap-md" style={{ alignItems: 'center', textAlign: 'center' }}>
          <Avatar username={outgoing.to.username} src={outgoing.to.avatarUrl} size={64} />
          <div>
            <div className="t-h3">Waiting on {outgoing.to.username}</div>
            <div className="t-sm mute" style={{ marginTop: 4 }}>
              {remaining > 0
                ? `They have ${remaining} seconds to answer.`
                : 'Time is up — they did not answer.'}
            </div>
          </div>
          <button className="btn btn--outline btn--block" onClick={cancel}>
            Cancel challenge
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="Challenge a player" onClose={onClose}>
      <div className="panel__body">
        <div className="search">
          <span className="search__icon">
            <Icon name="search" size={16} />
          </span>
          <input
            className="input"
            placeholder="Search by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="list" style={{ maxHeight: 340, overflowY: 'auto' }}>
        {players === null ? (
          <div className="panel__body">
            <div className="skeleton" style={{ height: 56 }} />
          </div>
        ) : players.length === 0 ? (
          <Empty icon="users" title="Nobody by that name" hint="Try a different spelling" />
        ) : (
          players.map((player) => (
            <div key={player.id} className="listrow">
              <Avatar username={player.username} src={player.avatarUrl} size={34} />
              <span className="listrow__main">
                <span className="listrow__name">{player.username}</span>
                <span className="listrow__sub">
                  <Tier rating={player.rating} />
                </span>
              </span>
              <button className="btn btn--sm btn--primary" onClick={() => challenge(player.id)}>
                Challenge
              </button>
            </div>
          ))
        )}
      </div>
    </Dialog>
  );
}

/* ---------------------------------------------------- incoming prompt -- */

/**
 * The prompt shown to the person being challenged.
 *
 * Lives at the app root rather than on the Play screen, because a challenge can
 * arrive while you are anywhere — reading your profile, on the leaderboard — and
 * an invite you only see if you happen to be in the lobby is not an invite.
 */
export function IncomingChallenge() {
  const incoming = useLobby((s) => s.incoming);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!incoming) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.round((incoming.expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [incoming]);

  if (!incoming) return null;

  const answer = (accept: boolean) => {
    getSocket()?.emit(accept ? 'challenge:accept' : 'challenge:decline', {
      challengeId: incoming.challengeId,
    });
    useLobby.getState().setIncoming(null);
    cue('select');
  };

  return (
    <div className="modal-scrim" role="presentation">
      <motion.div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Incoming challenge"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.26, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <div className="panel__body col gap-md" style={{ alignItems: 'center', textAlign: 'center' }}>
          <Avatar username={incoming.from.username} src={incoming.from.avatarUrl} size={72} />
          <div>
            <div className="t-caption mute">Challenge</div>
            <div className="t-h2" style={{ marginTop: 2 }}>
              {incoming.from.username}
            </div>
            <div className="t-sm dim" style={{ marginTop: 6, textTransform: 'capitalize' }}>
              {incoming.exerciseSlug.replace('-', ' ')} · {incoming.mode}
            </div>
          </div>

          {/* The countdown is the whole reason this is a modal: it expires, and
              the player has to know how long they have to decide. */}
          <span className={`chip ${remaining <= 10 ? 'chip--bad' : ''}`}>
            <Icon name="clock" size={13} />
            {remaining}s to answer
          </span>

          <div className="row gap-sm" style={{ width: '100%' }}>
            <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => answer(false)}>
              Decline
            </button>
            <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => answer(true)}>
              Accept
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------- room -- */

export function RoomDialog({
  exerciseSlug,
  onClose,
}: {
  exerciseSlug: string;
  onClose: () => void;
}) {
  const me = useAuth((s) => s.user);
  const room = useLobby((s) => s.room);
  const error = useLobby((s) => s.error);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  function create() {
    getSocket()?.emit('room:create', { exerciseSlug });
    cue('select');
  }

  function join() {
    if (code.trim().length !== 6) {
      useLobby.getState().setError('A room code is six characters');
      return;
    }
    getSocket()?.emit('room:join', { code: code.trim().toUpperCase() });
  }

  function leave() {
    getSocket()?.emit('room:leave');
    onClose();
  }

  function toggleReady(ready: boolean) {
    getSocket()?.emit('room:ready', { ready });
    cue('select');
  }

  async function copyCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be denied. The code is on screen in a large
      // monospace face precisely so it is readable and typeable without it.
      setCopied(false);
    }
  }

  if (room) {
    const you = room.occupants.find((o) => o.userId === me?.id);
    const full = room.occupants.length === 2;

    return (
      <Dialog title="Private room" onClose={leave}>
        <div className="panel__body col gap-md">
          <div className="col" style={{ alignItems: 'center', gap: 6 }}>
            <span className="t-caption mute">Room code</span>
            <button
              className="num"
              onClick={copyCode}
              style={{ fontSize: 40, letterSpacing: 6, color: 'var(--brand)' }}
              title="Copy code"
            >
              {room.code}
            </button>
            <span className="t-sm mute">
              {copied ? 'Copied to clipboard' : 'Tap the code to copy it'}
            </span>
          </div>

          <div className="divider" style={{ margin: 0 }} />

          <div className="col gap-sm">
            {room.occupants.map((occupant) => (
              <div key={occupant.userId} className="row" style={{ gap: 'var(--s3)' }}>
                <Avatar username={occupant.username} src={occupant.avatarUrl} size={36} />
                <span className="listrow__main">
                  <span className="listrow__name">
                    {occupant.username}
                    {occupant.userId === room.hostId && (
                      <span className="chip" style={{ marginLeft: 8, fontSize: 10, padding: '2px 7px' }}>
                        Host
                      </span>
                    )}
                  </span>
                  <span className="listrow__sub">{occupant.rating}</span>
                </span>
                <span className={`chip ${occupant.ready ? 'chip--ok' : ''}`}>
                  {occupant.ready ? 'Ready' : 'Waiting'}
                </span>
              </div>
            ))}

            {!full && (
              <div className="row" style={{ gap: 'var(--s3)', opacity: 0.6 }}>
                <span className="empty__icon" style={{ margin: 0, width: 36, height: 36 }}>
                  <Icon name="users" size={17} />
                </span>
                <span className="listrow__main">
                  <span className="listrow__name">Waiting for a second player</span>
                  <span className="listrow__sub">Send them the code</span>
                </span>
              </div>
            )}
          </div>

          <div className="alert alert--info" style={{ marginBottom: 0 }}>
            <Icon name="info" size={16} />
            Private matches do not change your rating.
          </div>

          <button
            className="btn btn--primary btn--block"
            disabled={!full}
            onClick={() => toggleReady(!you?.ready)}
          >
            {!full ? 'Waiting for an opponent' : you?.ready ? 'Cancel ready' : 'Ready'}
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="Private room" onClose={onClose}>
      <div className="panel__body col gap-md">
        {error && (
          <div className="alert alert--error" style={{ marginBottom: 0 }}>
            <Icon name="info" size={16} />
            {error}
          </div>
        )}

        <button className="btn btn--primary btn--block btn--lg" onClick={create}>
          <Icon name="plus" size={18} />
          Open a room
        </button>

        <div className="row" style={{ gap: 'var(--s3)' }}>
          <span className="divider" style={{ flex: 1, margin: 0 }} />
          <span className="t-caption mute">or join one</span>
          <span className="divider" style={{ flex: 1, margin: 0 }} />
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field__label" htmlFor="room-code">
            Room code
          </label>
          <input
            id="room-code"
            className="input mono"
            placeholder="ABC123"
            maxLength={6}
            value={code}
            style={{ textTransform: 'uppercase', letterSpacing: 4, fontSize: 20 }}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              useLobby.getState().setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') join();
            }}
          />
        </div>

        <button className="btn btn--ghost btn--block" onClick={join} disabled={code.length !== 6}>
          Join room
        </button>
      </div>
    </Dialog>
  );
}

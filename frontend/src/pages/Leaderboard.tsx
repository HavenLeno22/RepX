import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { rankForRating, type PublicUser } from '@repx/shared';
import { Avatar, type Presence } from '../components/Avatar';
import { Icon, type IconName } from '../components/Icon';
import { CountUp, Stagger, StaggerItem } from '../components/motion';
import { Emblem, Empty, ErrorState, Tier } from '../components/ui';
import { get, post } from '../lib/api';
import { cue } from '../lib/feedback';
import { EASE, SPRING } from '../lib/motion';
import { useAuth } from '../store/auth';
import { useToasts } from '../store/toasts';

interface Row extends PublicUser {
  rank: string;
  position: number;
  presence: Presence;
}

type Scope = 'global' | 'friends' | 'country';

const SCOPES: { id: Scope; label: string; icon: IconName }[] = [
  { id: 'global', label: 'Global', icon: 'globe' },
  { id: 'country', label: 'Country', icon: 'target' },
  { id: 'friends', label: 'Friends', icon: 'users' },
];

/**
 * The ladder.
 *
 * The old leaderboard was a list of usernames and numbers, which is the correct
 * shape for a scoreboard and the wrong shape for the screen a competitive player
 * checks most often. A ladder has to answer two things a list cannot: *who is at
 * the top, and how far am I from them?*
 *
 * Hence the podium — the top three rendered as people rather than rows one, two
 * and three — and the sticky "you" row, which follows the player down the board
 * so their own position is never scrolled off screen.
 */
export function Leaderboard() {
  const me = useAuth((s) => s.user);
  const pushToast = useToasts((s) => s.push);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [scope, setScope] = useState<Scope>('global');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  const load = useCallback(() => {
    setRows(null);
    setError(false);
    const params = new URLSearchParams({ scope, limit: '100' });
    if (search.trim()) params.set('search', search.trim());
    void get<Row[]>(`/leaderboard?${params}`)
      .then(setRows)
      .catch(() => setError(true));
  }, [scope, search]);

  // Debounced so typing does not fire a request per keystroke, and long enough
  // (280ms) that a fast typist gets one request rather than three.
  useEffect(() => {
    const id = setTimeout(load, search ? 280 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  const mine = rows?.find((r) => r.id === me?.id) ?? null;
  const podium = (rows ?? []).slice(0, 3);
  const rest = (rows ?? []).slice(3);

  async function addFriend(id: string, username: string) {
    setAdding(id);
    try {
      const result = await post<{ status: string }>(`/friends/${id}`);
      pushToast({
        category: 'challenge',
        title: result.status === 'accepted' ? 'Friend added' : 'Request sent',
        body:
          result.status === 'accepted'
            ? `You and ${username} are now friends.`
            : `${username} will see your request.`,
        href: '/friends',
      });
    } catch {
      pushToast({ category: 'system', title: 'Could not send that request' });
    } finally {
      setAdding(null);
    }
  }

  return (
    <>
      <div className="head">
        <span className="head__t">Leaderboard</span>
        {mine && (
          <span className="chip chip--brand">
            <Icon name="trending-up" size={13} />
            You're #{mine.position}
          </span>
        )}
      </div>

      <div className="col gap-md">
        {/* --------------------------------------------------- controls -- */}
        <div className="row wrap-row" style={{ gap: 'var(--s3)' }}>
          <div className="seg" role="group" aria-label="Board scope" style={{ flex: '1 1 260px' }}>
            {SCOPES.map((s) => (
              <button
                key={s.id}
                className="seg__opt"
                aria-pressed={scope === s.id}
                onClick={() => {
                  setScope(s.id);
                  cue('select');
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="search" style={{ flex: '1 1 220px' }}>
            <span className="search__icon">
              <Icon name="search" size={16} />
            </span>
            <input
              className="input"
              placeholder="Find a player"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search players"
            />
          </div>
        </div>

        {error ? (
          <div className="panel">
            <ErrorState message="Could not load the leaderboard" onRetry={load} />
          </div>
        ) : rows === null ? (
          <>
            <div className="skeleton" style={{ height: 188 }} />
            <div className="panel">
              <div className="panel__body col gap-sm">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="skeleton" style={{ height: 52, opacity: 1 - i * 0.09 }} />
                ))}
              </div>
            </div>
          </>
        ) : rows.length === 0 ? (
          <div className="panel">
            <Empty
              icon={scope === 'friends' ? 'users' : 'trophy'}
              title={
                search
                  ? 'No player by that name'
                  : scope === 'friends'
                    ? 'No friends on the board yet'
                    : scope === 'country'
                      ? 'Nobody from your country yet'
                      : 'Nobody has competed yet'
              }
              hint={
                scope === 'friends'
                  ? 'Add rivals from the global board'
                  : scope === 'country'
                    ? 'Set your country in settings to appear here'
                    : 'Win a ranked match to claim the top spot'
              }
              cta={scope === 'global' && !search ? 'Play ranked' : undefined}
              ctaTo={scope === 'global' && !search ? '/play' : undefined}
            />
          </div>
        ) : (
          <>
            {podium.length === 3 && !search && <Podium rows={podium} meId={me?.id} />}

            <div className="panel">
              <header className="panel__head">
                <span className="panel__title">
                  {podium.length === 3 && !search ? 'The chasing pack' : 'Standings'}
                </span>
                <span className="panel__title">Rating</span>
              </header>
              <Stagger className="list">
                {(podium.length === 3 && !search ? rest : rows).map((row, i) => (
                  <StaggerItem key={row.id} index={i}>
                    <BoardRow
                      row={row}
                      isMe={row.id === me?.id}
                      canAdd={Boolean(me) && row.id !== me?.id && scope !== 'friends'}
                      adding={adding === row.id}
                      onAdd={() => void addFriend(row.id, row.username)}
                    />
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </>
        )}
      </div>

      {/* The player's own row, pinned. Scrolling past your own position on a
          ladder is the one thing a ladder must never let you do. */}
      {mine && mine.position > 3 && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={SPRING}
          style={{
            position: 'sticky',
            bottom: 'calc(var(--safe-b) + var(--s3))',
            marginTop: 'var(--s4)',
            zIndex: 30,
          }}
        >
          <div
            className="panel"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--brand-edge)',
              boxShadow: 'var(--sh-float)',
            }}
          >
            <BoardRow row={mine} isMe canAdd={false} adding={false} onAdd={() => undefined} />
          </div>
        </motion.div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- podium -- */

const PODIUM_ORDER = [1, 0, 2]; // silver, gold, bronze — gold in the middle
const PODIUM_HEIGHTS = [96, 128, 80];
const PODIUM_COLORS = ['var(--silver)', 'var(--gold)', 'var(--bronze)'];

/**
 * The top three, staged.
 *
 * Rendered in visual rather than numerical order — second, first, third — because
 * that is what a podium is, and reading order follows the eye to the tallest
 * plinth rather than to the left edge.
 *
 * The plinths grow from zero on mount. It is the one piece of purely theatrical
 * motion in the product, and it earns its place: this is the only screen whose
 * job is to make a position feel like a prize.
 */
function Podium({ rows, meId }: { rows: Row[]; meId?: string }) {
  return (
    <section
      className="panel"
      style={{
        background: 'linear-gradient(180deg, var(--gold-wash), var(--card) 62%)',
        borderColor: 'var(--gold-edge)',
      }}
    >
      <div
        className="panel__body"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          alignItems: 'end',
          gap: 'var(--s3)',
          paddingBottom: 0,
        }}
      >
        {PODIUM_ORDER.map((index, slot) => {
          const row = rows[index];
          if (!row) return <div key={slot} />;
          const color = PODIUM_COLORS[index];

          return (
            <motion.div
              key={row.id}
              className="col"
              style={{ alignItems: 'center', textAlign: 'center' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + slot * 0.09, duration: 0.45, ease: EASE.standard }}
            >
              <Avatar
                username={row.username}
                src={row.avatarUrl}
                size={index === 0 ? 60 : 48}
                ring={color}
                presence={row.presence}
              />
              <div
                style={{
                  fontWeight: 800,
                  fontSize: index === 0 ? 15 : 13.5,
                  marginTop: 'var(--s2)',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: row.id === meId ? 'var(--brand)' : undefined,
                }}
              >
                {row.username}
              </div>
              <CountUp
                value={row.rating}
                duration={1100}
                className="num"
                style={{ fontSize: index === 0 ? 22 : 18, color, lineHeight: 1.3 }}
              />
              {row.country && <span className="t-caption mute">{row.country}</span>}

              <motion.div
                initial={{ height: 0 }}
                animate={{ height: PODIUM_HEIGHTS[index] }}
                transition={{ delay: 0.2 + slot * 0.09, duration: 0.6, ease: EASE.standard }}
                style={{
                  width: '100%',
                  marginTop: 'var(--s3)',
                  borderRadius: 'var(--r-card) var(--r-card) 0 0',
                  background: `linear-gradient(180deg, ${
                    index === 0 ? 'var(--gold-veil)' : 'var(--card-2)'
                  }, transparent)`,
                  boxShadow: `inset 0 1.5px 0 ${color}`,
                  display: 'grid',
                  placeItems: 'start center',
                  paddingTop: 'var(--s3)',
                  overflow: 'hidden',
                }}
              >
                <span className="num" style={{ fontSize: 26, color }}>
                  {index + 1}
                </span>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- row -- */

function BoardRow({
  row,
  isMe,
  canAdd,
  adding,
  onAdd,
}: {
  row: Row;
  isMe: boolean;
  canAdd: boolean;
  adding: boolean;
  onAdd: () => void;
}) {
  const rank = rankForRating(row.rating);
  const winRate = row.matchesPlayed > 0 ? Math.round((row.wins / row.matchesPlayed) * 100) : 0;

  return (
    <div
      className="listrow"
      style={{
        background: isMe ? 'var(--brand-wash)' : undefined,
        boxShadow: isMe ? 'inset 3px 0 0 var(--brand)' : undefined,
      }}
    >
      <span
        className="mono"
        style={{
          width: 28,
          textAlign: 'center',
          fontWeight: 800,
          fontSize: 13,
          color: isMe ? 'var(--brand)' : 'var(--text-3)',
        }}
      >
        {row.position}
      </span>

      <Avatar username={row.username} src={row.avatarUrl} size={34} presence={row.presence} />

      <span className="listrow__main">
        <span className="listrow__name">
          {row.username}
          {isMe && (
            <span
              className="t-caption"
              style={{ color: 'var(--brand)', marginLeft: 6, letterSpacing: 1 }}
            >
              YOU
            </span>
          )}
        </span>
        <span className="listrow__sub">
          {row.wins}W · {row.losses}L
          {row.matchesPlayed > 0 && ` · ${winRate}%`}
          {row.currentStreak >= 3 && (
            <span className="chip chip--warn" style={{ padding: '1px 6px', fontSize: 10.5 }}>
              <Icon name="flame" size={10} />
              {row.currentStreak}
            </span>
          )}
          {row.country && <span className="mute">· {row.country}</span>}
        </span>
      </span>

      {canAdd && (
        <button
          className="btn btn--outline btn--sm"
          onClick={onAdd}
          disabled={adding}
          aria-label={`Add ${row.username} as a friend`}
        >
          {adding ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <Icon name="plus" size={14} />}
        </button>
      )}

      <Emblem rating={row.rating} size="sm" glow={false} />

      <span className="col" style={{ alignItems: 'flex-end', width: 62 }}>
        <span className="num num-board" style={{ color: rank.color }}>
          {row.rating}
        </span>
        <span className="t-caption mute" style={{ fontSize: 9.5, letterSpacing: 0.5 }}>
          PEAK {row.peakRating}
        </span>
      </span>
    </div>
  );
}

/** Re-exported so Profile can show the same tier chip without importing ui twice. */
export { Tier };

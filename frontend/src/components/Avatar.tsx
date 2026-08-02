import { RANK_COLORS, alpha } from '@repx/shared';

export type Presence = 'online' | 'queueing' | 'in-match' | 'offline';

interface AvatarProps {
  username: string;
  src?: string | null;
  size?: number;
  /** A coloured ring. Used for competitor identity: lime is you, red is them. */
  ring?: string;
  presence?: Presence;
}

/**
 * Deterministic identity for a player without a photo.
 *
 * The old implementation derived an HSL hue from the username, which produced a
 * different arbitrary colour for every player — three hundred and sixty
 * unbudgeted colours in a product whose palette is meant to be locked, and
 * several of them (muddy olive, dull teal) close enough to Electric Lime to
 * dilute it. It also produced colours with no meaning at all.
 *
 * Now the fallback picks from the seven rank colours. The mapping is still
 * deterministic and still gives every player a stable identity, but every colour
 * it can produce is one the product already uses on purpose.
 */
const FALLBACKS = Object.values(RANK_COLORS);

export const PRESENCE_COLORS: Record<Presence, string> = {
  online: 'var(--ok)',
  queueing: 'var(--warn)',
  'in-match': 'var(--brand)',
  offline: 'var(--text-3)',
};

export function Avatar({ username, src, size = 40, ring, presence }: AvatarProps) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.max(10, size * 0.36),
    ...(ring ? { boxShadow: `0 0 0 2px ${ring}` } : {}),
  };

  const index = [...username].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const color = FALLBACKS[index % FALLBACKS.length];

  const inner = src ? (
    <img className="avatar" src={src} alt="" style={style} />
  ) : (
    <div
      className="avatar"
      style={{ ...style, background: alpha(color, 0.22), color, boxShadow: style.boxShadow }}
    >
      {username.slice(0, 2).toUpperCase()}
    </div>
  );

  if (!presence) return inner;

  return (
    <span className="avatar-wrap" title={PRESENCE_LABELS[presence]}>
      {inner}
      <span
        className="avatar-wrap__presence"
        style={{
          background: PRESENCE_COLORS[presence],
          width: Math.max(9, size * 0.28),
          height: Math.max(9, size * 0.28),
        }}
      />
    </span>
  );
}

export const PRESENCE_LABELS: Record<Presence, string> = {
  online: 'Online',
  queueing: 'Searching',
  'in-match': 'In a match',
  offline: 'Offline',
};

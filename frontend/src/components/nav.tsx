/**
 * App chrome: the left rail on desktop, the app bar and tab bar on touch.
 *
 * **The five primary destinations are identical, and in the same order, on both.**
 * Home, Ranks, Play, Battles, Profile. Moving between a phone and a laptop must
 * not move anything, because muscle memory is the cheapest speed a competitive
 * product can give a returning player.
 *
 * The rail additionally carries four secondary destinations — Achievements,
 * Friends, Notifications, Settings — in their own group below a divider. They
 * are not in the tab bar because five is the most a thumb can hit reliably and a
 * nine-item tab bar is a menu pretending to be navigation. On touch they are
 * reached from the app bar (notifications) and from the profile screen, which is
 * where a player already goes to look at their own things.
 *
 * Which chrome is visible is decided in CSS, never by measuring the viewport in
 * JavaScript, so the two can't drift apart.
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { cue } from '../lib/feedback';
import { useAuth } from '../store/auth';
import { useSummary } from '../store/summary';
import { Avatar } from './Avatar';
import { Icon, type IconName } from './Icon';

interface Destination {
  to: string;
  icon: IconName;
  label: string;
  end?: boolean;
  primary?: boolean;
}

/** The five that appear in both chromes, in tab-bar order. Play is the middle
 *  one because it is the primary action of the product and the middle of the bar
 *  is where a thumb rests. */
const PRIMARY: Destination[] = [
  { to: '/', icon: 'home', label: 'Home', end: true },
  { to: '/leaderboard', icon: 'trophy', label: 'Ranks' },
  { to: '/play', icon: 'swords', label: 'Play', primary: true },
  { to: '/battles', icon: 'history', label: 'Battles' },
  { to: '/profile', icon: 'user', label: 'Profile' },
];

const SECONDARY: Destination[] = [
  { to: '/tournaments', icon: 'medal', label: 'Tournaments' },
  { to: '/achievements', icon: 'star', label: 'Achievements' },
  { to: '/friends', icon: 'users', label: 'Friends' },
  { to: '/notifications', icon: 'bell', label: 'Notifications' },
  { to: '/settings', icon: 'settings', label: 'Settings' },
];

/* ---------------------------------------------------------------- rail -- */

export function Rail() {
  const user = useAuth((s) => s.user);
  const unread = useSummary((s) => s.summary?.unreadNotifications ?? 0);
  const navigate = useNavigate();

  return (
    <aside className="rail">
      <NavLink to="/" className="rail__brand">
        <span className="mark">
          <Icon name="zap" size={18} strokeWidth={2.2} />
        </span>
        RepX
      </NavLink>

      <NavLink
        to="/play"
        className="btn btn--play btn--block rail__cta"
        onClick={() => cue('tap')}
      >
        <Icon name="swords" size={19} strokeWidth={2} />
        Play
      </NavLink>

      <nav className="rail__nav" aria-label="Primary">
        {PRIMARY.filter((d) => !d.primary).map((link) => (
          <RailLink key={link.to} {...link} />
        ))}
      </nav>

      <div className="divider" />

      <nav className="rail__nav" aria-label="Secondary">
        {SECONDARY.map((link) => (
          <RailLink key={link.to} {...link} badge={link.to === '/notifications' ? unread : 0} />
        ))}
      </nav>

      <div className="rail__spacer" />

      {user && (
        <div className="rail__foot">
          <button className="rail__user" onClick={() => navigate('/profile')}>
            <Avatar username={user.username} src={user.avatarUrl} size={34} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span
                style={{
                  display: 'block',
                  fontWeight: 700,
                  fontSize: 14,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.username}
              </span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {user.rating}
              </span>
            </span>
            <Icon name="chevron-right" size={15} style={{ color: 'var(--text-3)' }} />
          </button>
        </div>
      )}
    </aside>
  );
}

function RailLink({ to, icon, label, end, badge = 0 }: Destination & { badge?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={() => cue('nav')}
      className={({ isActive }) => `rail__link${isActive ? ' rail__link--active' : ''}`}
    >
      <Icon name={icon} size={19} />
      <span>{label}</span>
      {badge > 0 && <span className="rail__badge">{badge > 99 ? '99+' : badge}</span>}
    </NavLink>
  );
}

/* -------------------------------------------------------------- appbar -- */

export function AppBar() {
  const user = useAuth((s) => s.user);
  const unread = useSummary((s) => s.summary?.unreadNotifications ?? 0);

  return (
    <header className="appbar">
      <NavLink to="/" className="appbar__brand">
        <span className="mark" style={{ width: 27, height: 27, borderRadius: 8 }}>
          <Icon name="zap" size={15} strokeWidth={2.2} />
        </span>
        RepX
      </NavLink>

      <span className="appbar__spacer" />

      {user && (
        <NavLink to="/profile" className="chip chip--brand" style={{ gap: 7 }}>
          <Icon name="trending-up" size={13} />
          <span className="mono">{user.rating}</span>
        </NavLink>
      )}

      <NavLink to="/notifications" className="appbar__icon" aria-label="Notifications">
        <Icon name="bell" size={19} />
        {unread > 0 && <span className="appbar__dot" />}
      </NavLink>
    </header>
  );
}

/* -------------------------------------------------------------- tabbar -- */

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Primary">
      <div className="tabbar__inner">
        {PRIMARY.map((d) => (
          <NavLink
            key={d.to}
            to={d.to}
            end={d.end}
            onClick={() => cue(d.primary ? 'tap' : 'nav')}
            className={({ isActive }) =>
              `tab${isActive ? ' tab--active' : ''}${d.primary ? ' tab--play' : ''}`
            }
          >
            <span className="tab__icon">
              <Icon name={d.icon} size={d.primary ? 22 : 20} strokeWidth={d.primary ? 2.2 : 1.8} />
            </span>
            <span>{d.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

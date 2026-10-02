/**
 * The public account-deletion page.
 *
 * This exists because Google Play requires it, and the requirement is specific
 * in a way that is easy to miss: the deletion route has to be reachable **from
 * outside the app, without signing in**, at a URL that can be pasted into the
 * Play Console listing. An in-app "Delete account" button — which RepX also has,
 * in Settings — does not satisfy it on its own. Someone who uninstalled the app,
 * or who never got past the login screen, still has to be able to find this.
 *
 * So the page is mounted on the signed-out router as well as the signed-in one,
 * and it is written to be useful to a reader with no session: it says exactly
 * what deletion removes, what survives and why, and gives a route that works
 * even when signing in is the thing that is broken.
 *
 * Deliberately not a form that accepts an email address and "starts" a deletion.
 * An unauthenticated endpoint that deletes accounts by email is an account-
 * takeover primitive, and one that merely *emails* the owner is a spam gadget
 * pointed at anybody whose address you can guess. Proof of ownership has to come
 * first, which means either a real session or a human at privacy@repx.app.
 */

import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Panel } from '../components/ui';
import { useAuth } from '../store/auth';

const SUPPORT_EMAIL = 'privacy@repx.app';

/** Removed outright, the moment the request completes. */
const ERASED = [
  'Your account: email address, username, password hash, avatar, bio and country.',
  'Your rating and rank, current and historical, across every season.',
  'Your side of every match you have played — reps, quality scores, result and rating change.',
  'Trophies, achievements, missions, streaks and XP.',
  'Friendships, friend requests, blocks and pending challenges.',
  'Every session and every device you are signed in on.',
  'Any unused verification or password-reset links.',
];

/** Kept, and the honest reason why. */
const RETAINED = [
  {
    what: 'The match record itself, minus you.',
    why: 'A match has two players. Deleting the row would erase your opponent’s history along with yours, and their record is theirs. What is removed is your participation in it: after deletion the match shows an opponent who no longer exists, with none of your data attached.',
  },
  {
    what: 'Server logs, for up to 30 days.',
    why: 'Request logs are written for security and debugging and roll off on their own. They contain IP addresses and timestamps, not match data or anything you typed.',
  },
];

export function DeleteAccount() {
  const user = useAuth((s) => s.user);

  return (
    <div className="col gap-md" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="head">
        <h1 className="head__t">Delete your account</h1>
      </div>

      <Panel>
        <div className="row" style={{ gap: 'var(--s3)', alignItems: 'flex-start' }}>
          <Icon
            name="info"
            size={20}
            style={{ color: 'var(--bad)', marginTop: 2, flexShrink: 0 }}
          />
          <p className="t-body-lg" style={{ color: 'var(--text)' }}>
            Deletion is immediate and permanent. There is no grace period, no
            archive and no way for us to bring an account back — including for
            you, and including if you ask the next day.
          </p>
        </div>
      </Panel>

      <Panel title="How to delete it">
        <div className="col gap-sm">
          <p className="t-body dim">
            <strong style={{ color: 'var(--text)' }}>If you can sign in</strong> — open{' '}
            <strong style={{ color: 'var(--text)' }}>Settings → Delete account</strong>, type your
            username to confirm, and it is done. This is the fastest route and it needs nobody&rsquo;s
            help.
          </p>
          <p className="t-body dim">
            <strong style={{ color: 'var(--text)' }}>If you cannot sign in</strong> — write to{' '}
            <a href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`}>
              {SUPPORT_EMAIL}
            </a>{' '}
            from the address on the account. We will verify that it is yours and delete it within 30
            days, usually the same week. We ask you to mail from the account address because we have
            no other way to tell you apart from someone trying to delete your account for you.
          </p>
        </div>

        <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s4)', flexWrap: 'wrap' }}>
          {user ? (
            <Link to="/settings" className="btn btn--primary">
              <Icon name="settings" size={16} />
              Go to Settings
            </Link>
          ) : (
            <Link to="/login" className="btn btn--primary">
              Sign in to delete
            </Link>
          )}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`} className="btn btn--ghost">
            Email {SUPPORT_EMAIL}
          </a>
        </div>
      </Panel>

      <Panel title="What gets erased">
        <ul className="col gap-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {ERASED.map((item) => (
            <li key={item} className="row t-body dim" style={{ gap: 'var(--s2)', alignItems: 'flex-start' }}>
              <Icon
                name="x"
                size={14}
                style={{ color: 'var(--bad)', marginTop: 5, flexShrink: 0 }}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="What is kept, and why">
        <div className="col gap-sm">
          {RETAINED.map((item) => (
            <div key={item.what}>
              <p className="t-body" style={{ color: 'var(--text)' }}>
                {item.what}
              </p>
              <p className="t-body dim">{item.why}</p>
            </div>
          ))}
          <p className="t-body dim">
            Neither one can be used to identify you or to reconstruct your account.
          </p>
        </div>
      </Panel>

      <Panel title="Your camera">
        <p className="t-body dim">
          Nothing to delete. RepX never received any video: pose estimation runs on your own device
          and only joint coordinates are sent, which are discarded once the match settles. There is
          no footage of you on our servers to erase, and there never was. See the{' '}
          <Link to="/privacy">privacy terms</Link> for the detail.
        </p>
      </Panel>

      <div className="row" style={{ justifyContent: 'center', padding: 'var(--s4) 0' }}>
        <Link to={user ? '/' : '/login'} className="btn btn--ghost">
          Back to RepX
        </Link>
      </div>
    </div>
  );
}

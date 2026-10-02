/**
 * The account flows that arrive by email, plus the consent gate.
 *
 * All three are full-bleed screens rather than dialogs, because each is reached
 * by following a link from outside the app — a person landing here has just come
 * from their mailbox, and dropping them into a modal over a page they were not
 * looking at is disorienting.
 */

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CONSENT_VERSION } from '@repx/shared';
import { Icon } from '../components/Icon';
import { post } from '../lib/api';
import { useAuth } from '../store/auth';

/* --------------------------------------------------------------- shell -- */

function Shell({
  icon,
  tone = 'brand',
  title,
  children,
}: {
  icon: 'check' | 'info' | 'lock' | 'camera';
  tone?: 'brand' | 'bad';
  title: string;
  children: React.ReactNode;
}) {
  const color = tone === 'bad' ? 'var(--bad)' : 'var(--brand)';
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100%', padding: 'var(--s6)' }}>
      <motion.div
        className="panel"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ width: '100%', maxWidth: 460 }}
      >
        <div className="panel__body" style={{ padding: 'var(--s6)' }}>
          <span
            className="empty__icon"
            style={{
              margin: '0 0 var(--s4)',
              color,
              background: tone === 'bad' ? 'var(--bad-wash)' : 'var(--brand-wash)',
            }}
          >
            <Icon name={icon} size={26} />
          </span>
          <h1 className="t-h1" style={{ marginBottom: 'var(--s3)' }}>
            {title}
          </h1>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------- verification -- */

export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const refreshUser = useAuth((s) => s.refreshUser);
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('failed');
      setMessage('That link is missing its token. Open the most recent email and try again.');
      return;
    }

    void post('/auth/verify', { token })
      .then(async () => {
        setState('done');
        // The signed-in user's own record just changed, so pull it fresh rather
        // than leaving a stale "unverified" banner on screen behind this page.
        await refreshUser().catch(() => undefined);
      })
      .catch((error: unknown) => {
        setState('failed');
        setMessage(
          error instanceof Error
            ? error.message
            : 'That link has expired or has already been used.',
        );
      });
  }, [token, refreshUser]);

  if (state === 'working') {
    return (
      <Shell icon="info" title="Confirming your address">
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <span className="spinner" />
          <span className="t-body dim">One moment.</span>
        </div>
      </Shell>
    );
  }

  if (state === 'failed') {
    return (
      <Shell icon="info" tone="bad" title="That link did not work">
        <p className="t-body dim" style={{ marginBottom: 'var(--s5)' }}>
          {message} You can send yourself a new one from Settings.
        </p>
        <Link to="/" className="btn btn--primary btn--block">
          Back to RepX
        </Link>
      </Shell>
    );
  }

  return (
    <Shell icon="check" title="Address confirmed">
      <p className="t-body dim" style={{ marginBottom: 'var(--s5)' }}>
        Your account is secured. Password recovery will reach you at this address.
      </p>
      <Link to="/play" className="btn btn--play btn--lg btn--block">
        <Icon name="swords" size={19} strokeWidth={2.2} />
        Play ranked
      </Link>
    </Shell>
  );
}

/* -------------------------------------------------------- reset request -- */

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    // Deliberately ignores the outcome. The server answers identically for a
    // real address and an unknown one, and so does this screen — anything else
    // turns the form into a way to find out who has an account.
    await post('/auth/password/forgot', { email: email.trim() }).catch(() => undefined);
    setBusy(false);
    setSent(true);
  }

  if (sent) {
    return (
      <Shell icon="check" title="Check your inbox">
        <p className="t-body dim" style={{ marginBottom: 'var(--s5)' }}>
          If <strong>{email.trim()}</strong> has a RepX account, a reset link is on its way. It
          expires in an hour.
        </p>
        <Link to="/login" className="btn btn--ghost btn--block">
          Back to sign in
        </Link>
      </Shell>
    );
  }

  return (
    <Shell icon="lock" title="Reset your password">
      <p className="t-body dim" style={{ marginBottom: 'var(--s5)' }}>
        Enter the address on your account and we will send you a link.
      </p>
      <form onSubmit={submit}>
        <div className="field">
          <label className="field__label" htmlFor="reset-email">
            Email
          </label>
          <input
            id="reset-email"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <button className="btn btn--primary btn--block" disabled={busy || !email.trim()}>
          {busy ? <span className="spinner" /> : 'Send the link'}
        </button>
      </form>
      <Link
        to="/login"
        className="t-sm dim"
        style={{ display: 'block', textAlign: 'center', marginTop: 'var(--s4)' }}
      >
        Back to sign in
      </Link>
    </Shell>
  );
}

/* --------------------------------------------------------- reset finish -- */

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8 || password !== confirm) return;

    setBusy(true);
    setError(null);
    try {
      await post('/auth/password/reset', { token, password });
      // Every session was revoked server-side as part of the reset, including
      // any the person resetting was already holding — so the only correct next
      // step is signing in again.
      navigate('/login?reset=1', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That link has expired or has already been used.');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <Shell icon="info" tone="bad" title="That link is incomplete">
        <p className="t-body dim" style={{ marginBottom: 'var(--s5)' }}>
          Open the most recent reset email, or ask for a new link.
        </p>
        <Link to="/forgot" className="btn btn--primary btn--block">
          Ask for a new link
        </Link>
      </Shell>
    );
  }

  return (
    <Shell icon="lock" title="Choose a new password">
      <p className="t-body dim" style={{ marginBottom: 'var(--s5)' }}>
        This signs you out everywhere else, which is what you want if somebody else has been in
        your account.
      </p>

      {error && (
        <div className="alert alert--error">
          <Icon name="info" size={16} />
          {error}
        </div>
      )}

      <form onSubmit={submit}>
        <div className="field">
          <label className="field__label" htmlFor="new-password">
            New password
          </label>
          <input
            id="new-password"
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          {tooShort && <span className="field__hint" style={{ color: 'var(--bad)' }}>
            Passwords must be at least 8 characters.
          </span>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="confirm-password">
            Confirm
          </label>
          <input
            id="confirm-password"
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="Type it again"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {mismatch && <span className="field__hint" style={{ color: 'var(--bad)' }}>
            Those do not match.
          </span>}
        </div>

        <button
          className="btn btn--primary btn--block"
          disabled={busy || password.length < 8 || password !== confirm}
        >
          {busy ? <span className="spinner" /> : 'Set new password'}
        </button>
      </form>
    </Shell>
  );
}

/* -------------------------------------------------------------- consent -- */

/**
 * The camera consent gate.
 *
 * Shown before a player can enter the arena for the first time, and again
 * whenever CONSENT_VERSION moves — agreeing to an earlier policy is not agreeing
 * to a later one.
 *
 * It states plainly what is processed and what is kept, because the honest
 * summary is genuinely reassuring: pose estimation runs on the device, and what
 * reaches the server is a list of joint coordinates, never video.
 */
export function ConsentGate({ onGranted }: { onGranted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshUser = useAuth((s) => s.refreshUser);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await post('/users/me/consent', { version: CONSENT_VERSION });
      await refreshUser().catch(() => undefined);
      onGranted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record that. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-scrim" role="presentation">
      <motion.div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Camera and data"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 520 }}
      >
        <div className="panel__body" style={{ padding: 'var(--s6)' }}>
          <span
            className="empty__icon"
            style={{ margin: '0 0 var(--s4)', color: 'var(--cyan)', background: 'var(--cyan-wash)' }}
          >
            <Icon name="camera" size={26} />
          </span>

          <h2 className="t-h2" style={{ marginBottom: 'var(--s3)' }}>
            Before your first match
          </h2>
          <p className="t-body dim" style={{ marginBottom: 'var(--s4)' }}>
            RepX counts your reps by watching how you move. Here is exactly what that means.
          </p>

          <ul className="col gap-sm" style={{ listStyle: 'none', marginBottom: 'var(--s5)' }}>
            {[
              ['check', 'Your camera runs only during a match, and the video never leaves your device.'],
              ['check', 'What reaches our server is a list of joint positions — coordinates, not images.'],
              ['check', 'Those positions are used to verify reps and detect cheating, then discarded.'],
              ['check', 'You can delete your account and everything in it at any time, from Settings.'],
            ].map(([icon, text]) => (
              <li key={text} className="row" style={{ gap: 'var(--s3)', alignItems: 'flex-start' }}>
                <Icon
                  name={icon as 'check'}
                  size={16}
                  strokeWidth={2.6}
                  style={{ color: 'var(--brand)', marginTop: 3, flexShrink: 0 }}
                />
                <span className="t-body dim">{text}</span>
              </li>
            ))}
          </ul>

          {error && (
            <div className="alert alert--error">
              <Icon name="info" size={16} />
              {error}
            </div>
          )}

          <button className="btn btn--primary btn--block btn--lg" disabled={busy} onClick={() => void accept()}>
            {busy ? <span className="spinner" /> : 'I understand — let me play'}
          </button>

          <div className="row" style={{ justifyContent: 'center', marginTop: 'var(--s3)' }}>
            <Link to="/privacy" className="t-sm dim">
              Read the full privacy terms
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

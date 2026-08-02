import { motion } from 'framer-motion';
import { useEffect, useState, type FormEvent } from 'react';
import { loginSchema, registerSchema, type Season } from '@repx/shared';
import { Icon, type IconName } from '../components/Icon';
import { ApiError, get } from '../lib/api';
import { cue } from '../lib/feedback';
import { EASE } from '../lib/motion';
import { useAuth } from '../store/auth';

/** Three facts, three lines. Deliberately not paragraphs — this is the only
 *  screen in the product where a stranger is deciding whether to bother, and
 *  three claims they can check beats one they have to read. */
const CLAIMS: { icon: IconName; label: string }[] = [
  { icon: 'brain', label: 'Every rep AI-verified' },
  { icon: 'trending-up', label: 'Chess-style ELO rating' },
  { icon: 'zap', label: 'Live 1v1, 60 seconds' },
];

export function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [season, setSeason] = useState<Season | null>(null);
  const [pulse, setPulse] = useState<{ online: number } | null>(null);

  const { login, register } = useAuth();

  // Both are public endpoints. Showing a live season and a live player count on
  // the sign-in screen is the cheapest honest proof that this is a running
  // competition rather than an empty app.
  useEffect(() => {
    void get<Season>('/season').then(setSeason).catch(() => undefined);
    void get<{ online: number }>('/pulse').then(setPulse).catch(() => undefined);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed =
      mode === 'login'
        ? loginSchema.safeParse({ email, password })
        : registerSchema.safeParse({ email, username, password });

    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Check your details');
      cue('error');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') await login({ email, password });
      else await register({ email, username, password });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      cue('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      {/* A single lime bloom behind the pitch. The only decorative element on the
          screen, and it is what makes the first frame read as RepX rather than
          as a form. */}
      <div className="login__glow" aria-hidden />

      <div className="login__inner">
        {/* ---------------------------------------------------------- pitch */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE.standard }}
        >
          <div className="row" style={{ gap: 'var(--s3)', marginBottom: 'var(--s6)' }}>
            <span className="mark" style={{ width: 42, height: 42, borderRadius: 12 }}>
              <Icon name="zap" size={22} strokeWidth={2.2} />
            </span>
            <span style={{ fontWeight: 900, fontSize: 26, letterSpacing: -1.1 }}>RepX</span>
          </div>

          <h1 className="t-dxl">
            Bodyweight fitness,
            <br />
            <span className="brand">as a ranked sport.</span>
          </h1>

          <div className="row wrap-row" style={{ gap: 'var(--s2)', marginTop: 'var(--s6)' }}>
            {CLAIMS.map((claim) => (
              <span key={claim.label} className="chip">
                <Icon name={claim.icon} size={13} />
                {claim.label}
              </span>
            ))}
          </div>

          {(season || pulse) && (
            <div className="row wrap-row" style={{ gap: 'var(--s2)', marginTop: 'var(--s3)' }}>
              {season && (
                <span className="chip chip--brand">
                  <Icon name="calendar" size={13} />
                  Season {season.number} · {season.name}
                </span>
              )}
              {pulse && pulse.online > 0 && (
                <span className="chip chip--ok">
                  <span className="chip__dot chip__dot--pulse" />
                  {pulse.online} competing now
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* ----------------------------------------------------------- form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: EASE.standard }}
          className="panel"
        >
          <form onSubmit={submit} className="panel__body" style={{ padding: 'var(--s5)' }}>
            <div className="seg" style={{ marginBottom: 'var(--s5)' }} role="group" aria-label="Sign in or sign up">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className="seg__opt"
                  aria-pressed={mode === m}
                  onClick={() => {
                    setMode(m);
                    setError(null);
                    cue('select');
                  }}
                >
                  {m === 'login' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            {error && (
              <div className="alert alert--error">
                <Icon name="info" size={17} style={{ marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <div className="field">
              <label className="field__label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            {mode === 'register' && (
              <div className="field">
                <label className="field__label" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="How you'll appear on the ladder"
                />
              </div>
            )}

            <div className="field">
              <label className="field__label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            <button className="btn btn--play btn--block btn--lg" disabled={busy}>
              {busy ? (
                <span className="spinner" />
              ) : (
                <>
                  <Icon name="swords" size={19} strokeWidth={2.2} />
                  {mode === 'login' ? 'Enter the arena' : 'Start competing'}
                </>
              )}
            </button>

            <div className="divider" />

            <div className="row" style={{ justifyContent: 'center', gap: 'var(--s2)', flexWrap: 'wrap' }}>
              <span className="t-caption mute">Try it</span>
              <span className="chip">rookie@repx.dev</span>
              <span className="chip">repx1234</span>
            </div>
          </form>
        </motion.div>
      </div>

      <style>{`
        .login {
          position: relative;
          min-height: 100vh;
          display: grid;
          align-items: center;
          padding: var(--s8) var(--s5) calc(var(--s8) + var(--safe-b));
          overflow: hidden;
        }
        .login__glow {
          position: absolute;
          left: -160px;
          top: -140px;
          width: 620px;
          height: 620px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--brand-bloom), transparent 66%);
          pointer-events: none;
        }
        .login__inner {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 420px);
          gap: var(--s16);
          max-width: 1000px;
          margin: 0 auto;
          width: 100%;
          align-items: center;
        }
        @media (max-width: 900px) {
          .login { align-items: start; }
          .login__inner { grid-template-columns: 1fr; gap: var(--s6); }
        }
      `}</style>
    </div>
  );
}

import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { updateProfileSchema, type PublicUser } from '@repx/shared';
import { Avatar } from '../components/Avatar';
import { Icon, type IconName } from '../components/Icon';
import { Panel } from '../components/ui';
import { ApiError, api, post } from '../lib/api';
import { cue } from '../lib/feedback';
import { useAuth } from '../store/auth';
import { usePrefs, type MotionPref } from '../store/prefs';

/** Longest edge for a stored avatar. Keeps the data URL small enough to sit in a
 *  database column without thinking about it. */
const AVATAR_MAX_PX = 256;

/**
 * Downscales and re-encodes a chosen image in the browser before upload, so a
 * 12MP phone photo becomes a ~30KB JPEG rather than being rejected for size.
 */
function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a valid image'));
      img.onload = () => {
        const scale = Math.min(1, AVATAR_MAX_PX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not process that image'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Settings.
 *
 * Grouped, and every switch here does something. The old screen's headline
 * control was a light/dark toggle; RepX is dark-only now, so the space it
 * occupied went to the settings that were actually missing — motion, contrast,
 * and feedback — which are the ones a competitive product used mid-workout
 * genuinely needs.
 *
 * Nothing on this screen is a placeholder. A settings page full of switches that
 * do nothing is the clearest signal a product is unfinished.
 */
export function Settings() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const setUser = useAuth((s) => s.setUser);
  const prefs = usePrefs();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [country, setCountry] = useState(user?.country ?? '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatarUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const dirty =
    username !== user.username ||
    (bio ?? '') !== (user.bio ?? '') ||
    (country ?? '') !== (user.country ?? '') ||
    avatar !== (user.avatarUrl ?? null);

  async function pickAvatar(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setAvatar(await fileToAvatarDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that image');
    }
  }

  async function save() {
    setError(null);
    setSaved(false);

    const payload = {
      username,
      bio: bio.trim() === '' ? null : bio.trim(),
      country: country.trim() === '' ? null : country.trim(),
      avatarUrl: avatar,
    };

    const parsed = updateProfileSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Check your details');
      cue('error');
      return;
    }

    setBusy(true);
    try {
      setUser(await api<PublicUser>('/users/me', { method: 'PATCH', body: JSON.stringify(parsed.data) }));
      setSaved(true);
      cue('toggle');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile');
      cue('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="head">
        <span className="head__t">Settings</span>
      </div>

      <div className="col gap-md" style={{ maxWidth: 680 }}>
        {/* ==================================================== profile == */}
        <Panel title="Profile">
          {error && (
            <div className="alert alert--error">
              <Icon name="info" size={17} style={{ marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}
          {saved && !dirty && (
            <div className="alert alert--ok">
              <Icon name="check-circle" size={17} style={{ marginTop: 1 }} />
              <span>Profile saved.</span>
            </div>
          )}

          <div className="row" style={{ gap: 'var(--s4)', marginBottom: 'var(--s5)' }}>
            <Avatar username={username || user.username} src={avatar} size={76} />
            <div>
              <div className="row gap-sm">
                <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
                  <Icon name="camera" size={15} />
                  Upload
                </button>
                {avatar && (
                  <button className="btn btn--outline btn--sm" onClick={() => setAvatar(null)}>
                    Remove
                  </button>
                )}
              </div>
              <span className="chip" style={{ marginTop: 'var(--s2)' }}>
                Resized to {AVATAR_MAX_PX}px in your browser
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => void pickAvatar(e.target.files?.[0])}
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="username">
              Username
            </label>
            <input id="username" className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="country">
              Country
            </label>
            <input
              id="country"
              className="input"
              value={country}
              placeholder="Appears on the leaderboard"
              onChange={(e) => setCountry(e.target.value)}
            />
            <span className="field__hint">Setting this unlocks the country leaderboard.</span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="bio">
              Bio
            </label>
            <textarea
              id="bio"
              className="input"
              value={bio}
              maxLength={160}
              placeholder="Optional"
              onChange={(e) => setBio(e.target.value)}
            />
            <span className="field__hint">{bio.length}/160</span>
          </div>

          <button className="btn btn--primary btn--block" disabled={!dirty || busy} onClick={() => void save()}>
            {busy ? <span className="spinner" /> : 'Save changes'}
          </button>
        </Panel>

        {/* ================================================ accessibility == */}
        <Panel title="Motion and contrast">
          <Row
            icon="sparkle"
            title="Animation"
            hint="Reduced keeps every state change, but arrives instantly"
          >
            <div className="seg" style={{ width: 240 }} role="group" aria-label="Animation">
              {(['system', 'full', 'reduced'] as MotionPref[]).map((m) => (
                <button
                  key={m}
                  className="seg__opt"
                  aria-pressed={prefs.motion === m}
                  onClick={() => {
                    prefs.set('motion', m);
                    cue('toggle');
                  }}
                >
                  {m === 'system' ? 'System' : m === 'full' ? 'Full' : 'Reduced'}
                </button>
              ))}
            </div>
          </Row>

          <div className="divider" />

          <Row
            icon="check-circle"
            title="High contrast"
            hint="Lifts every border and brightens secondary text"
          >
            <Toggle
              on={prefs.highContrast}
              onChange={(v) => prefs.set('highContrast', v)}
              label="High contrast"
            />
          </Row>
        </Panel>

        {/* ===================================================== feedback == */}
        <Panel title="Feedback">
          <Row icon="zap" title="Haptics" hint="A pulse on reps, results and promotions">
            <Toggle on={prefs.haptics} onChange={(v) => prefs.set('haptics', v)} label="Haptics" />
          </Row>

          <div className="divider" />

          <Row icon="info" title="Sound" hint="Off until the sound pack ships — the switch is live now">
            <Toggle on={prefs.sound} onChange={(v) => prefs.set('sound', v)} label="Sound" />
          </Row>
        </Panel>

        {/* ================================================== competition == */}
        <Panel title="Competition">
          <Row icon="camera" title="Camera and pose data" hint="How rep verification actually works">
            <span />
          </Row>
          <p className="t-sm dim" style={{ marginTop: 'var(--s2)' }}>
            Your camera feed never leaves this device. RepX runs pose estimation locally and sends
            only the 33 skeleton coordinates to the server, which re-counts every rep itself. That is
            what makes a rating trustworthy — and it is also why no video of you exists to leak.
          </p>
        </Panel>

        {/* ===================================================== account == */}
        <Panel title="Account">
          <div className="row between" style={{ marginBottom: 'var(--s4)' }}>
            <span className="t-sm mute" style={{ fontWeight: 700 }}>
              Player ID
            </span>
            <span className="mono" style={{ fontSize: 13 }}>
              {user.id.slice(0, 14)}…
            </span>
          </div>
          <div className="row between" style={{ marginBottom: 'var(--s4)' }}>
            <span className="t-sm mute" style={{ fontWeight: 700 }}>
              Competing since
            </span>
            <span className="mono" style={{ fontSize: 13 }}>
              {new Date(user.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
          <button
            className="btn btn--danger btn--block"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <Icon name="log-out" size={17} />
            Sign out
          </button>
        </Panel>

        <Panel title="Your data">
          <div className="col gap-sm" style={{ marginBottom: 'var(--s4)' }}>
            <Link to="/privacy" className="listrow" style={{ padding: 0, minHeight: 40 }}>
              <span className="listrow__main">
                <span className="listrow__name">Privacy terms</span>
                <span className="listrow__sub">What the camera does, and what we keep</span>
              </span>
              <Icon name="chevron-right" size={16} />
            </Link>
            <Link to="/terms" className="listrow" style={{ padding: 0, minHeight: 40 }}>
              <span className="listrow__main">
                <span className="listrow__name">Terms</span>
                <span className="listrow__sub">Fair play, conduct, and training safely</span>
              </span>
              <Icon name="chevron-right" size={16} />
            </Link>
          </div>
          <DeleteAccount username={user.username} />
        </Panel>
      </div>
    </>
  );
}

/* -------------------------------------------------------------- erasure -- */

/**
 * Account deletion.
 *
 * Two-step, and the second step is typing your own username. This is the one
 * irreversible action in the product — it takes every match, rating and trophy
 * with it — and a destructive control that fires on a single click is a
 * destructive control that fires by accident.
 */
function DeleteAccount({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  const matches = confirm.trim().toLowerCase() === username.toLowerCase();

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post('/users/me/delete', { confirmUsername: confirm.trim() });
      logout();
      navigate('/login', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the account. Try again.');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn--danger btn--block" onClick={() => setOpen(true)}>
        <Icon name="skull" size={17} />
        Delete account
      </button>
    );
  }

  return (
    <div className="col gap-sm">
      <div className="alert alert--error" style={{ marginBottom: 0 }}>
        <Icon name="info" size={16} />
        <span>
          This removes your account, every match you have played, your rating, your trophies and
          your friendships. It is immediate and cannot be undone.
        </span>
      </div>

      {error && (
        <div className="alert alert--error" style={{ marginBottom: 0 }}>
          <Icon name="info" size={16} />
          {error}
        </div>
      )}

      <div className="field" style={{ marginBottom: 0 }}>
        <label className="field__label" htmlFor="confirm-delete">
          Type <strong>{username}</strong> to confirm
        </label>
        <input
          id="confirm-delete"
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          autoFocus
        />
      </div>

      <div className="row gap-sm">
        <button
          className="btn btn--ghost"
          style={{ flex: 1 }}
          onClick={() => {
            setOpen(false);
            setConfirm('');
            setError(null);
          }}
        >
          Keep my account
        </button>
        <button
          className="btn btn--danger"
          style={{ flex: 1 }}
          disabled={!matches || busy}
          onClick={() => void submit()}
        >
          {busy ? <span className="spinner" /> : 'Delete for good'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ bits -- */

function Row({
  icon,
  title,
  hint,
  children,
}: {
  icon: IconName;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="row between" style={{ gap: 'var(--s4)', flexWrap: 'wrap' }}>
      <span className="row" style={{ gap: 'var(--s3)', flex: '1 1 220px' }}>
        <span className="empty__icon" style={{ margin: 0, width: 38, height: 38, borderRadius: 'var(--r-input)' }}>
          <Icon name={icon} size={17} />
        </span>
        <span>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 14.5 }}>{title}</span>
          <span className="t-sm mute" style={{ fontWeight: 500 }}>
            {hint}
          </span>
        </span>
      </span>
      {children}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      className="switch"
      data-on={on}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => {
        onChange(!on);
        cue('toggle');
      }}
    >
      <span className="switch__knob" />
    </button>
  );
}

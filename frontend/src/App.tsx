import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppBar, Rail, TabBar } from './components/nav';
import { OfflineBanner } from './components/OfflineBanner';
import { Toasts } from './components/Toasts';
import { useMatchSocket } from './hooks/useMatchSocket';
import { PAGE } from './lib/motion';
import { Achievements } from './pages/Achievements';
import { Battles } from './pages/Battles';
import { Friends } from './pages/Friends';
import { Home } from './pages/Home';
import { Leaderboard } from './pages/Leaderboard';
import { Login } from './pages/Login';
import { Match } from './pages/Match';
import { Notifications } from './pages/Notifications';
import { Onboarding, hasOnboarded } from './pages/Onboarding';
import { Play } from './pages/Play';
import { Profile } from './pages/Profile';
import { Result } from './pages/Result';
import { CONSENT_VERSION } from '@repx/shared';
import { ConsentGate, ForgotPassword, ResetPassword, VerifyEmail } from './pages/Account';
import { DeleteAccount } from './pages/DeleteAccount';
import { Privacy } from './pages/Privacy';
import { Settings } from './pages/Settings';
import { Terms } from './pages/Terms';
import { Tournaments } from './pages/Tournaments';
import { IncomingChallenge } from './components/play-dialogs';
import { useAuth } from './store/auth';
import { useConnection } from './store/connection';
import { useSummary } from './store/summary';

export function App() {
  const { user, ready, restore, refreshUser } = useAuth();
  const refreshSummary = useSummary((s) => s.refresh);
  const reachable = useConnection((s) => s.reachable);
  const location = useLocation();

  useEffect(() => {
    void restore();
  }, [restore]);

  /**
   * Come back on our own once the API is answering again.
   *
   * A restore that failed because the server was unreachable deliberately keeps
   * the stored tokens (see store/auth.ts), so all that is missing is a second
   * attempt. Without this the player sits on the sign-in screen with a perfectly
   * valid session in localStorage, waiting for a reload nobody told them to do.
   *
   * Fires only on the false → true edge, not whenever `reachable` is true:
   * `reachable` starts true, so a plain truthiness check would race the boot
   * restore above and connect the socket twice on every cold start.
   */
  const wasReachable = useRef(reachable);
  useEffect(() => {
    const cameBack = reachable && !wasReachable.current;
    wasReachable.current = reachable;
    if (cameBack && !user) void restore();
  }, [reachable, user, restore]);

  // The progression snapshot backs the navigation badge as well as the home
  // screen, so it is fetched once here rather than by whichever screen happens
  // to be mounted.
  useEffect(() => {
    if (user) void refreshSummary();
  }, [user, refreshSummary]);

  useMatchSocket();

  if (!ready) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        {/*
          The only spinner in the product, and it is here because there is
          genuinely no known shape to skeleton: we do not yet know whether this
          person has an account.
        */}
        <div className="spinner" style={{ width: 26, height: 26, color: 'var(--brand)' }} />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {/*
          Mounted on the signed-out tree too. If the API is down, the sign-in
          form is exactly where somebody hits it first, and "Incorrect email or
          password" would be a lie.
        */}
        <OfflineBanner />
        <Routes>
        <Route path="/login" element={<Login />} />
        {/*
          Reachable signed out, and they have to be: every one of these is
          arrived at from outside the app — a link in an email, or a privacy
          policy someone wants to read *before* handing over an address.
          Bouncing them to /login would strand the token in a URL they have
          already navigated away from.

          /delete-account is signed-out for a harder reason than the rest:
          Google Play requires the deletion route to be reachable without an
          account, from a URL pasted into the store listing. Someone who has
          already uninstalled the app has to be able to land here.
        */}
        <Route path="/verify" element={<VerifyEmail />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/delete-account" element={<DeleteAccount />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </>
    );
  }

  // Onboarding runs full-bleed and once. It is gated on a local flag rather than
  // a server field deliberately: it teaches the interface, and reinstalling on a
  // new device is exactly when someone needs that again.
  if (!hasOnboarded()) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    );
  }

  // The arena is full-bleed — no chrome competes with the camera feed.
  if (location.pathname === '/match') {
    return (
      <Routes>
        <Route path="/match" element={<Match />} />
      </Routes>
    );
  }

  /**
   * Camera consent, gated on the lobby rather than the arena.
   *
   * The arena is where the camera actually opens, but by then the player has an
   * opponent waiting and a countdown running — asking a legal question at that
   * moment is both bad manners and bad consent, because the only real answer
   * available is yes. Asking in the lobby, before anyone is matched, leaves
   * declining as a genuine option.
   *
   * Re-prompts whenever the terms version moves: agreeing to an earlier policy
   * is not agreeing to a later one.
   */
  const consentCurrent = user.consentVersion === CONSENT_VERSION;
  const needsConsent = !consentCurrent && location.pathname === '/play';

  return (
    <div className="app">
      <Rail />
      <main className="main">
        <AppBar />
        <div className="wrap">
          {/*
            Keyed on the path so each screen lifts in as its own view, the way a
            native stack pushes, rather than the whole document repainting in
            place. `mode="wait"` matters here: overlapping a 190ms exit with a
            190ms enter produces a visible cross-dissolve, which reads as a web
            page and not an app.
          */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={PAGE}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/play" element={<Play />} />
                <Route path="/result" element={<Result />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/tournaments" element={<Tournaments />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/delete-account" element={<DeleteAccount />} />
                <Route path="/verify" element={<VerifyEmail />} />
                <Route path="/reset" element={<ResetPassword />} />
                <Route path="/forgot" element={<ForgotPassword />} />
                <Route path="/battles" element={<Battles />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/friends" element={<Friends />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <TabBar />
      <Toasts />
      {/*
        Mounted at the root, not on the lobby: a challenge can arrive while the
        player is anywhere in the app, and an invite you only see if you happen
        to be looking at the Play screen is not an invite.
      */}
      <IncomingChallenge />
      <OfflineBanner />
      {needsConsent && <ConsentGate onGranted={() => void refreshUser()} />}
    </div>
  );
}

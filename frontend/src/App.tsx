import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppBar, Rail, TabBar } from './components/nav';
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
import { Settings } from './pages/Settings';
import { useAuth } from './store/auth';
import { useSummary } from './store/summary';

export function App() {
  const { user, ready, restore } = useAuth();
  const refreshSummary = useSummary((s) => s.refresh);
  const location = useLocation();

  useEffect(() => {
    void restore();
  }, [restore]);

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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
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
    </div>
  );
}

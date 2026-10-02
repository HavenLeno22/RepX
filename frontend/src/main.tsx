import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { bootstrapPrefs } from './store/prefs';
import './styles/global.css';

// Applied before React mounts so the first paint already honours the player's
// motion and contrast preferences. Getting this after mount would mean an
// animation running once for someone who asked for none.
bootstrapPrefs();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

/**
 * Register the service worker, in production only.
 *
 * Kept off in development on purpose: a worker that caches the app shell fights
 * Vite's hot module replacement, and the resulting "why is my change not
 * showing" is a half-hour nobody gets back.
 *
 * Registered after `load` so it never competes for bandwidth with the first
 * paint or with the pose model warm-up.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // A failed registration costs offline support and nothing else, so it is
      // not worth interrupting anybody over.
    });
  });
}

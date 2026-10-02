/**
 * RepX service worker.
 *
 * Deliberately conservative. A service worker is the one piece of a web app that
 * can permanently break it for a returning user — cache the wrong thing and
 * people get a stale bundle that no refresh clears — so this one does the least
 * that delivers the benefit:
 *
 *   - **Navigations are network-first.** The freshest app always wins. The cache
 *     is only consulted when the network fails, which is the offline case this
 *     exists for.
 *   - **Hashed build assets are cache-first.** Vite fingerprints filenames, so a
 *     given URL's content can never change; serving it from cache is free and
 *     cannot go stale.
 *   - **Nothing else is touched.** API calls, WebSocket traffic and the pose
 *     model are all left alone. Caching an API response would show somebody a
 *     leaderboard from last week and caching a match request would be worse.
 *
 * Bumping CACHE retires every previous cache on activate, which is the escape
 * hatch if this ever does go wrong.
 */

const CACHE = 'repx-v1';

/** The shell: enough to boot the app and say something useful while offline. */
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Individually, so one missing file cannot fail the whole install and
      // leave the app with no worker at all.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET. A cached POST is a replayed action.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin only. Cross-origin here would mean the API, the provider SDKs
  // and the font CDN, none of which this worker should be deciding about.
  if (url.origin !== self.location.origin) return;

  // The API is same-origin behind a proxy in some deployments — never cache it.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          /**
           * Only a good response becomes the offline shell.
           *
           * This cached whatever came back. A host returning a 502 during a
           * deploy, or a 404 page from a misconfigured rewrite, was written
           * over `/index.html` — and from then on every offline launch served
           * that error page as the app, with no way for the user to clear it.
           * The one thing a service worker must never do is make a transient
           * failure permanent.
           */
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html').then((hit) => hit ?? Response.error())),
    );
    return;
  }

  // Fingerprinted build output: content-addressed, so cache-first is safe.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

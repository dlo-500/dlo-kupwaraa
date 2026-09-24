// DLO Kupwara — Service Worker v2.1 (offline-capable)
// Changes from v2.0: relative pre-cache paths (work at the domain root or under /dlo-kupwaraa/),
// pre-cache no longer all-or-nothing, error responses are never cached, same-origin assets revalidate
// so a new assistant.js / index.html is picked up immediately.
const STATIC_CACHE = 'dlo-kupwara-static-v5';
const DATA_CACHE   = 'dlo-kupwara-data-v5';

// Relative URLs resolve against this file's location, so they follow wherever the site is hosted.
const STATIC_ASSETS = [
  './',
  './index.html',
  './logo.png',
  './manifest.json',
  './offline.html',
];

// Only keep good responses (200-range) or opaque cross-origin ones (CDN scripts, fonts).
const cacheable = res => res && (res.ok || res.type === 'opaque');

// ═══════════════════════════════════════════════
//  INSTALL — precache the app shell + offline page (each file independently)
// ═══════════════════════════════════════════════
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      Promise.allSettled(STATIC_ASSETS.map(asset => cache.add(asset)))
    )
  );
  self.skipWaiting();
});

// ═══════════════════════════════════════════════
//  ACTIVATE — drop old cache versions
// ═══════════════════════════════════════════════
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DATA_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Lets the page tell a waiting worker to activate immediately (used for the
// "update available — tap to refresh" prompt on the front end).
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// Legacy Google Sheets ("gviz") requests append a random cache-busting query string,
// so they are cached under a normalised key (the sheet name). Kept for any page that still uses Sheets.
function sheetCacheKey(url) {
  const sheet = url.searchParams.get('sheet') || 'default';
  return new Request(self.location.origin + '/__sheet-cache__/' + encodeURIComponent(sheet));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Analytics — best-effort only, never cache, never block on it.
  if (url.hostname.includes('cloudflareinsights.com')) {
    event.respondWith(fetch(req).catch(() => new Response('', { status: 204 })));
    return;
  }

  // Legacy Google Sheets data — network-first, last good copy when offline.
  if (url.hostname === 'docs.google.com' && url.pathname.includes('/gviz/tq')) {
    const cacheKey = sheetCacheKey(url);
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(DATA_CACHE).then(cache => cache.put(cacheKey, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(cacheKey);
          if (cached) {
            const body = await cached.text();
            return new Response(body, {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'X-DLO-Offline': '1' }
            });
          }
          return new Response('Offline', { status: 503 });
        })
    );
    return;
  }

  // Legacy Apps Script calls — live actions, not cacheable.
  if (url.hostname === 'script.google.com') {
    event.respondWith(fetch(req).catch(() => new Response('Offline', { status: 503 })));
    return;
  }

  // Page navigations — network-first; fall back to the cached page, then the cached shell,
  // then the friendly offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(req, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(req)
            .then(cached => cached || caches.match('./index.html'))
            .then(cached => cached || caches.match('./offline.html'))
        )
    );
    return;
  }

  // Non-GET calls (logins, inserts, updates): the Cache API only supports GET — pass through.
  if (req.method !== 'GET') {
    event.respondWith(fetch(req));
    return;
  }

  // Supabase GET calls (case data, auth session checks, profile lookups) —
  // NEVER cache these. The data is sensitive and often viewed on shared office
  // computers; caching would let it survive logout in Cache Storage.
  // (The assistant reads the same data in memory only and stores nothing.)
  if (url.hostname.endsWith('.supabase.co')) {
    event.respondWith(fetch(req).catch(() => new Response('Offline', { status: 503 })));
    return;
  }

  // Everything else (CSS/JS/images/fonts) — network-first with a cache fallback.
  // Same-origin files are revalidated so a new deploy (e.g. assistant.js) is not held back
  // by the browser's HTTP cache.
  const init = url.origin === self.location.origin ? { cache: 'no-cache' } : undefined;
  event.respondWith(
    fetch(req, init)
      .then(res => {
        if (cacheable(res)) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

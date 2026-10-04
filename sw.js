// DLO Kupwara: versioned shell cache with network-first page updates.
// Bump CACHE_VERSION on every deployment: it renames both caches, so the old
// pair is deleted on activate and no old HTML/JS/CSS can be mixed with new files.
const CACHE_VERSION = 14;
const STATIC_CACHE = 'dlo-kupwara-static-v' + CACHE_VERSION;
const DATA_CACHE = 'dlo-kupwara-data-v' + CACHE_VERSION;

// Third-party libraries/fonts the pages need to run offline.
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

// If any of these fail to download, the install fails and the previous
// (consistent) service worker + cache stay in charge.
const REQUIRED_ASSETS = ['./', './index.html', './app.html', './config.js', './common.js', './styles.css', './menu.css'];

const STATIC_ASSETS = [
  './',
  './index.html',
  './app.html',
  './offline.html',
  './404.html',
  './manifest.json',
  './config.js',
  './common.js',
  './translations.js',
  './styles.css',
  './menu.css',
  './styles-performance.css',
  './search-filter-cases.html',
  './analytics.html',
  './statistics.html',
  './court-wise-distribution.html',
  './areas-of-practice.html',
  './our-officials.html',
  './about-office.html',
  './contact.html',
  './public-enquiries.html',
  './latest-updates.html',
  './hearings.html',
  './causelist.html',
  './history.html',
  './performance.html',
  './operator.html',
  './logo.png',
  './icons/dlo-kupwara-app-icon-192.png',
  './icons/dlo-kupwara-app-icon-512.png',
  './icons/dlo-kupwara-app-icon.jpeg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const failedRequired = [];
    await Promise.all(STATIC_ASSETS.map(async path => {
      try {
        const request = new Request(path, { cache: 'reload' });
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response);
        else if (REQUIRED_ASSETS.includes(path)) failedRequired.push(path);
      } catch (_) {
        if (REQUIRED_ASSETS.includes(path)) failedRequired.push(path);
      }
    }));
    if (failedRequired.length) {
      await caches.delete(STATIC_CACHE);
      throw new Error('DLO SW install aborted, could not fetch: ' + failedRequired.join(', '));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key !== STATIC_CACHE && key !== DATA_CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function sheetCacheKey(url) {
  const sheet = url.searchParams.get('sheet') || 'default';
  return new Request(self.location.origin + '/__sheet-cache__/' + encodeURIComponent(sheet));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.hostname.includes('cloudflareinsights.com')) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 204 })));
    return;
  }

  if (url.hostname === 'docs.google.com' && url.pathname.includes('/gviz/tq')) {
    const cacheKey = sheetCacheKey(url);
    event.respondWith(fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(DATA_CACHE).then(cache => cache.put(cacheKey, copy));
      }
      return response;
    }).catch(() => caches.open(DATA_CACHE).then(cache => cache.match(cacheKey).then(cached =>
      cached || new Response(JSON.stringify({ error: 'offline' }), {
        status: 503, headers: { 'Content-Type': 'application/json' }
      })
    ))));
    return;
  }

  if (url.hostname.endsWith('supabase.co')) {
    event.respondWith(fetch(request).catch(() => new Response('{"error":"offline"}', {
      status: 503, headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response && response.status === 404) {
        return caches.match('./404.html').then(cached => cached || response);
      }
      if (response && response.ok && request.method === 'GET' && url.origin === self.location.origin) {
        const copy = response.clone();
        caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match(request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return caches.match('./offline.html').then(offline => {
        if (offline) return offline;
        return caches.match('./app.html').then(app => app || caches.match('./index.html'));
      });
    })));
    return;
  }

  // Only GET requests are cached; anything else goes straight to the network.
  if (request.method !== 'GET') return;

  const isCdn = CDN_HOSTS.includes(url.hostname);
  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin && !isCdn) return;

  // Network-first keeps updated page assets visible as soon as they are online.
  event.respondWith(fetch(request).then(response => {
    // Opaque (no-cors) CDN responses report ok=false but are valid to store.
    if (response && (response.ok || (isCdn && response.type === 'opaque'))) {
      const copy = response.clone();
      caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request).then(cached =>
    cached || new Response('', { status: 504, statusText: 'Offline' })
  )));
});

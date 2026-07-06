// DLO Kupwara — Service Worker v1.0 (NK.1.0)
const CACHE_NAME = 'dlo-kupwara-v1';
const STATIC_ASSETS = [
  '/dlo-kupwaraa/',
  '/dlo-kupwaraa/index.html',
  '/dlo-kupwaraa/logo.png',
  '/dlo-kupwaraa/manifest.json',
];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', event => {
  // Always fetch Google Sheets data fresh — never cache API calls
  if (event.request.url.includes('docs.google.com') ||
      event.request.url.includes('script.google.com') ||
      event.request.url.includes('cloudflareinsights.com')) {
    event.respondWith(fetch(event.request).catch(() => new Response('Offline', {status: 503})));
    return;
  }

  // Network first for everything else
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

const CACHE_NAME = 'healthtracker-cache-v3';
const ASSETS_TO_CACHE = [
  '.',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  // Activate immediately so a deploy is picked up on the next navigation.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Core app files: network-first so new deploys propagate quickly.
  const isCore = sameOrigin && (
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    /\.(html|js|css|webmanifest)$/i.test(url.pathname)
  );

  if (isCore) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Same-origin assets (images, etc.): cache-first with fetch fallback.
  if (sameOrigin) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  // Cross-origin (Supabase API, CDN): pass through, never cached.
  event.respondWith(fetch(event.request));
});
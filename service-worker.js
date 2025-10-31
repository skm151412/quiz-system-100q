const CACHE_VERSION = 'v20251031-1';
const CACHE_NAME = `quiz-app-cache-${CACHE_VERSION}`;

// Precache a minimal set of versioned assets. HTML will be handled network-first.
const ASSETS = [
  '/',
  '/index.html?v=20251031-1',
  '/style.css?v=20251031-1',
  '/script.js?v=20251031-1',
  '/firebase-init.js?v=20251031-1',
  '/firebase-api.js?v=20251031-1',
  '/teacher.html?v=20251031-1',
  '/teacher.js?v=20251031-1'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const req = event.request;
  const url = new URL(req.url);

  // Always bypass SW for the SW script itself
  if (url.pathname.endsWith('/service-worker.js')) return;

  const accept = req.headers.get('accept') || '';
  const isHTML = accept.includes('text/html') || req.destination === 'document';

  // Network-first for HTML documents to avoid stale UI
  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for versioned static assets
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      });
    })
  );
});

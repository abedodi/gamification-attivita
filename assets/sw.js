const CACHE = 'gameact-v1';

const APP_SHELL = [
  './',
  './index.html',
  './css/main.css',
  './css/theme.css',
  './css/auth.css',
  './css/dashboard.css',
  './css/editor.css',
  './css/play.css',
  './css/log.css',
  './css/components.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Solo risorse della stessa origine (non Firebase, CDN, Google Fonts)
  if (!e.request.url.startsWith(self.location.origin)) return;
  // Solo GET
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      });
      return cached || network;
    })
  );
});

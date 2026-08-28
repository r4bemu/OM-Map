// NIA MIMAROPA O&M GIS Service Worker (Network-First Strategy)
const CACHE_VERSION = 'nia-gis-v4-prod';
const STATIC_ASSETS = ['/manifest.json', '/nia-logo.png', '/asd.ico.png'];

self.addEventListener('install', (e) => {
  // Activate immediately without waiting for old workers
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => console.warn('[SW] Cache addAll skipped:', err));
    })
  );
});

self.addEventListener('activate', (e) => {
  // Purge all obsolete caches immediately
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_VERSION) {
            console.log('[SW] Purging obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Strictly NEVER intercept Vite HMR or dev modules or API calls
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/@fs') ||
    url.pathname.startsWith('/@id') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.includes('node_modules') ||
    url.pathname.includes('hot-update') ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1'
  ) {
    return; // Pass directly to network / Vite HMR server
  }

  // Network-First strategy for production assets
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(e.request))
  );
});
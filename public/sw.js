// Minimal Service Worker for Taco (塔可) PWA Installability
// Complies with Android / Chrome PWA install criteria without caching dynamic AI or chat data.

const CACHE_NAME = 'taco-pwa-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strictly skip POST/PUT/DELETE, API proxy routes, and AI vendor endpoints
  if (
    event.request.method !== 'GET' ||
    url.pathname.includes('/api/') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('openai.com') ||
    url.hostname.includes('deepseek') ||
    url.hostname.includes('siliconflow')
  ) {
    return;
  }

  // Network-first pass-through for static files
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      return cached || new Response('离线状态', { status: 503, statusText: 'Offline' });
    })
  );
});

const GHPATH = '/Talk-And-Task';
const CACHE_NAME = 'talk-task-v1';

const URLS_TO_CACHE = [
  `${GHPATH}/`,
  `${GHPATH}/index.html`,
  `${GHPATH}/manifest.json`,
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request).then(
          networkResponse => {
            if (!event.request.url.startsWith(self.location.origin) ||
                event.request.method !== 'GET') {
              return networkResponse;
            }
            return caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          }
        ).catch(() => {
          return new Response(
            '<html><body><h1>You are offline</h1><p>Talk & Task will work again once you reconnect.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    }).then(() => self.clients.claim())
  );
});
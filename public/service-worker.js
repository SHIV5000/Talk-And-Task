const CACHE_NAME = 'talk-task-v5';
const urlsToCache = [
  '/',
  '/index.html',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event – cache static assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Activate event – clean old caches
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

// Fetch – network first, fallback to cache
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful GET requests
        if (event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification (triggered from the app when page is hidden)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: 'https://cdn-icons-png.flaticon.com/512/825/825590.png',
      badge: 'https://cdn-icons-png.flaticon.com/512/825/825590.png',
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true
    });
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      if (windowClients.length > 0) {
        let client = windowClients[0];
        for (let i = 0; i < windowClients.length; i++) {
          if (windowClients[i].focused) { client = windowClients[i]; break; }
        }
        return client.focus();
      } else {
        return clients.openWindow('/');
      }
    })
  );
});

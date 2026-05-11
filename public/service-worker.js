const CACHE_NAME = 'talk-task-cache-v6';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/icon-192.png',
  '/icon-512.png'
];

// Install – cache only your own static assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Activate – clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Fetch – network first for everything except static assets
self.addEventListener('fetch', event => {
  const { request } = event;

  // NEVER cache Firestore / Firebase API calls – always go to network
  if (
    request.url.includes('firestore.googleapis.com') ||
    request.url.includes('firebasestorage.googleapis.com') ||
    request.url.includes('identitytoolkit.googleapis.com') ||
    request.url.includes('securetoken.googleapis.com') ||
    request.url.includes('googleapis.com')
  ) {
    // Let the network request pass through untouched – service worker stays silent
    return;
  }

  // For your own static assets, try cache first, then network
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        // Cache successful GET requests for your own origin
        if (response && response.status === 200 && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
      return cached || fetchPromise;
    }).catch(() => {
      // If both cache and network fail (offline), return a simple fallback for navigation
      if (request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});

// Push notifications
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

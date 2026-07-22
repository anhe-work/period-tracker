/* ===== Service Worker for Period Tracker PWA ===== */
/* Cache-first strategy for offline use */

const CACHE_NAME = 'period-tracker-v1';
const STATIC_ASSETS = [
  './',
  './index.html'
  // Icons are cached by the browser naturally, but we'll cache them too
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    }).catch(function() {
      // Even if some assets fail, the service worker should still install
      return Promise.resolve();
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var request = event.request;

  // Only cache GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(request).then(function(cachedResponse) {
      if (cachedResponse) {
        // Return cached version and update cache in background
        fetch(request).then(function(networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(request, networkResponse);
            });
          }
        }).catch(function() {
          // Network failed, but we already have cached version
        });
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request).then(function(networkResponse) {
        if (networkResponse && networkResponse.status === 200) {
          var clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, clone);
          });
        }
        return networkResponse;
      }).catch(function() {
        // Network failed, no cache - return empty response
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

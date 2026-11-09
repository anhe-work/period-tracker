/* ===== Service Worker for Period Tracker PWA ===== */
/* 页面：网络优先（发版即生效）· 静态资源：缓存优先（可离线） */

const CACHE_NAME = 'period-tracker-v1.6.7';
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

  var accept = request.headers.get('accept') || '';
  var isPage = request.mode === 'navigate' || accept.indexOf('text/html') !== -1;

  // 页面本身（index.html）：网络优先。发版后用户下一次打开就能拿到新版，
  // 不会再被旧缓存挡住；断网时才回退到缓存，离线能力不变。
  if (isPage) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' }).then(function(networkResponse) {
        if (networkResponse && networkResponse.status === 200) {
          var clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, clone);
          });
        }
        return networkResponse;
      }).catch(function() {
        // Network failed -> fall back to cached page
        return caches.match(request).then(function(cached) {
          if (cached) return cached;
          return caches.match('./index.html').then(function(fallback) {
            return fallback || new Response('Offline', { status: 503, statusText: 'Offline' });
          });
        });
      })
    );
    return;
  }

  // 其它静态资源（图标等）：缓存优先，快且可离线，后台静默更新
  event.respondWith(
    caches.match(request).then(function(cachedResponse) {
      if (cachedResponse) {
        fetch(request).then(function(networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            var fresh = networkResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(request, fresh);
            });
          }
        }).catch(function() {
          // Network failed, but we already have cached version
        });
        return cachedResponse;
      }

      return fetch(request).then(function(networkResponse) {
        if (networkResponse && networkResponse.status === 200) {
          var clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, clone);
          });
        }
        return networkResponse;
      }).catch(function() {
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

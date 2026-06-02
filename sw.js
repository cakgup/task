const CACHE_NAME = 'tugas-keluarga-v4';

const APP_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './style.css',
  './config.js',
  './app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (cacheName) {
            return cacheName !== CACHE_NAME;
          })
          .map(function (cacheName) {
            return caches.delete(cacheName);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isNavigation = event.request.mode === 'navigate';
  const isRuntimeConfig = isSameOrigin && requestUrl.pathname.endsWith('/config.js');

  event.respondWith(
    (async function () {
      if (isNavigation || isRuntimeConfig) {
        try {
          const freshResponse = await fetch(event.request);
          return freshResponse;
        } catch (error) {
          const fallbackResponse = await caches.match(event.request);
          if (fallbackResponse) return fallbackResponse;
          if (isNavigation) return caches.match('./index.html');
          throw error;
        }
      }

      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) return cachedResponse;
      return fetch(event.request);
    })()
  );
});

self.addEventListener('push', function (event) {
  var payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { title: 'Tugas Keluarga', body: event.data ? event.data.text() : 'Ada pembaruan baru.' };
  }

  var title = payload.title || 'Tugas Keluarga';
  var options = {
    body: payload.body || 'Ada pembaruan baru.',
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/icon-192.png',
    data: {
      url: payload.url || './',
      type: payload.type || 'general'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

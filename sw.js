const CACHE_NAME = 'versus-letra-v7';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './modules/auth-user.js',
  './modules/bootstrap.js',
  './modules/config.js',
  './modules/crazygames.js',
  './modules/friends-online.js',
  './modules/game-data.js',
  './modules/i18n-content.js',
  './modules/party-mode.js',
  './modules/state-defaults.js',
  './modules/translations.js',
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first para arquivos locais: acelera reload e navegação.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchAndUpdate = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchAndUpdate;
    })
  );
});

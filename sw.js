const CACHE_NAME = 'versus-letra-v5';
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

// Install Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate and Clean Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// Fetch Strategy: Network First for assets, bypass for external APIs
self.addEventListener('fetch', (event) => {
  // Ignora chamadas para Supabase ou PeerJS (não devem ser cacheadas pelo SW)
  if (event.request.url.includes('supabase.co') || event.request.url.includes('peerjs')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a resposta for válida, atualiza o cache (para arquivos locais)
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

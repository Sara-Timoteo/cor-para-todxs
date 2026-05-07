/* ====================================================================
   Service Worker - Roda ColorADD + CDU
   Estrategia: app-shell em cache-first; fontes/CDN em stale-while-revalidate.
   ==================================================================== */

const CACHE_VERSION = 'cor-para-todxs-v9';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

// Install: pre-popula cache com app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(err => console.warn('[SW] Falha a popular cache:', err))
  );
  self.skipWaiting();
});

// Activate: limpa caches antigas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: estrategia hibrida
self.addEventListener('fetch', event => {
  const request = event.request;

  // So cacheia GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Nao interfere com pedidos do Formspree (envio de form)
  if (url.hostname.indexOf('formspree.io') !== -1) return;

  // Nao cacheia pedidos de mailto:, chrome-extension://, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  event.respondWith(
    caches.match(request).then(cached => {
      // Stale-while-revalidate: devolve cache se existe, atualiza em background
      const networkFetch = fetch(request)
        .then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => {
              // Cacheia same-origin + Google Fonts + jsdelivr
              const isCacheable =
                url.origin === self.location.origin
                || url.hostname.indexOf('googleapis.com') !== -1
                || url.hostname.indexOf('gstatic.com') !== -1
                || url.hostname.indexOf('jsdelivr.net') !== -1;
              if (isCacheable) {
                cache.put(request, clone).catch(() => {});
              }
            });
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    }).catch(() => {
      // Ultima opcao: se for navegacao, devolve a pagina principal
      if (request.mode === 'navigate') return caches.match('./index.html');
    })
  );
});

// Permite a pagina pedir update do SW quando ha nova versao
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

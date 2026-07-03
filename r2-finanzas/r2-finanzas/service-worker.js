/* R2 FINANZAS — Service Worker
 * Cachea el "app shell" para que la aplicación abra sin conexión.
 * Los datos (Google Sheets) siempre se piden a la red y se
 * respaldan localmente en el dispositivo (localStorage) desde script.js.
 */
const CACHE = 'r2-finanzas-v2';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nunca cachear llamadas a la API (Apps Script) ni a CDNs de datos.
  const isApi = url.hostname.includes('script.google.com') ||
                url.hostname.includes('googleusercontent.com');
  if (isApi || req.method !== 'GET') {
    event.respondWith(fetch(req).catch(() => new Response('{"ok":false,"offline":true}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // App shell: cache-first con actualización en segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

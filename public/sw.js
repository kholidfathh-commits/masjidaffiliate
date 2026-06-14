/* Al-Kahfi Team App - Service Worker
 * Tujuan: bikin app bisa di-install di HP (PWA) + bisa dibuka saat offline.
 * Strategi aman supaya update dari Vercel tetap langsung kebaca:
 *   - Halaman (navigasi/index.html) -> NETWORK FIRST (selalu ambil versi terbaru, fallback cache kalau offline)
 *   - Aset statis hash Vite (js/css/png) -> CACHE FIRST (nama file berubah tiap deploy, jadi aman)
 *   - Permintaan ke Supabase / font / CDN -> dibiarkan lewat (tidak di-cache)
 */
const CACHE = 'alkahfi-pwa-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))
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
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Hanya tangani origin sendiri. Supabase, Google Fonts, CDN dibiarkan apa adanya.
  if (url.origin !== self.location.origin) return;

  // Navigasi halaman -> network first
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Aset statis -> cache first, isi cache di belakang layar
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});

// IMPORTANTE: Atualize VERSION em cada deploy para forçar atualização em todos os clientes
const VERSION = '20250526e';
const CACHE = `loja-v${VERSION}`;
const SHELL = [
  './loja.html',
  './loja-manifest.json',
  './styles/loja.css',
  './styles/glass.css',
  './scripts/loja.js',
  './assets/logo.png',
  './assets/logo.svg',
  './assets/cat-texture.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u =>
        fetch(u, { cache: 'no-cache' })
          .then(r => { if (r.ok) return c.put(u, r); })
          .catch(() => {})
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit =>
          hit || (req.mode === 'navigate' ? caches.match('./loja.html') : Response.error())
        )
      )
  );
});

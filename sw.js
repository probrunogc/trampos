/**
 * SERVICE WORKER — Empório das Bebidas
 * Estratégia: network-first com fallback de cache.
 *  - Online  → sempre busca a versão fresca e atualiza o cache.
 *  - Offline → serve do cache; navegação cai no index.html.
 * Nunca serve código velho com internet — seguro pra atualizações.
 */
const CACHE = 'emporio-v5';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './styles/theme.css',
  './styles/layout.css',
  './styles/components.css',
  './styles/modules.css',
  './styles/print.css',
  './scripts/app.js',
  './scripts/core.js',
  './scripts/firebase-config.js',
  './scripts/product-art.js',
  './scripts/modules/dashboard.js',
  './scripts/modules/sales.js',
  './scripts/modules/reports.js',
  './scripts/modules/customers.js',
  './scripts/modules/products.js',
  './scripts/modules/deliveries.js',
  './scripts/modules/deliverers.js',
  './scripts/modules/users.js',
  './scripts/modules/settings.js',
  './assets/logo.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Deixa Firebase, fontes e CDNs passarem direto (sem interceptar)
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit =>
          hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())
        )
      )
  );
});

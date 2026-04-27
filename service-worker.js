const CACHE = 'heures-sup-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './paystub-pdf.js',
  './paystub-ui.js',
  './stats-fix.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

async function withStatsFixScript(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  if (!html.includes('stats-fix.js')) {
    html = html.replace('</body>', '<script src="./stats-fix.js"></script></body>');
  }

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isHtml = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  const isAppScript =
    url.pathname.endsWith('/paystub-ui.js') ||
    url.pathname.endsWith('/paystub-pdf.js') ||
    url.pathname.endsWith('/stats-fix.js') ||
    url.pathname.endsWith('/service-worker.js');

  if (isHtml) {
    event.respondWith(
      fetch(req, { cache: 'reload' })
        .then(async (res) => {
          const fixed = await withStatsFixScript(res.clone());
          const cacheCopy = fixed.clone();
          caches.open(CACHE).then((c) => c.put(req, cacheCopy)).catch(() => {});
          return fixed;
        })
        .catch(() => caches.match(req).then((r) => r ? withStatsFixScript(r) : caches.match('./index.html').then((x) => x ? withStatsFixScript(x) : x)))
    );
    return;
  }

  if (isAppScript) {
    event.respondWith(
      fetch(req, { cache: 'reload' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

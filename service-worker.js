const CACHE = 'heures-sup-v22';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './paystub-pdf.js',
  './paystub-ui.js',
  './stats-fix.js',
  './rrq-fix.js',
  './stats-projection-fix.js',
  './payroll-settings-simulation.js',
  './ai-assistant.js',
  './menu-polish.js',
  './ai-data-entry.js',
  './navigation-recovery.js',
  './gemini-assistant-bridge.js',
  './gemini-key-settings.js',
  './paystub-history.js',
  './week-tools.js',
  './week-direct-clear.js'
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

async function withExtraScripts(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  const scripts = [];
  if (!html.includes('stats-fix.js')) scripts.push('<script src="./stats-fix.js"></script>');
  if (!html.includes('rrq-fix.js')) scripts.push('<script src="./rrq-fix.js"></script>');
  if (!html.includes('stats-projection-fix.js')) scripts.push('<script src="./stats-projection-fix.js"></script>');
  if (!html.includes('payroll-settings-simulation.js')) scripts.push('<script src="./payroll-settings-simulation.js"></script>');
  if (!html.includes('ai-assistant.js')) scripts.push('<script src="./ai-assistant.js"></script>');
  if (!html.includes('menu-polish.js')) scripts.push('<script src="./menu-polish.js"></script>');
  if (!html.includes('ai-data-entry.js')) scripts.push('<script src="./ai-data-entry.js"></script>');
  if (!html.includes('navigation-recovery.js')) scripts.push('<script src="./navigation-recovery.js"></script>');
  if (!html.includes('gemini-assistant-bridge.js')) scripts.push('<script src="./gemini-assistant-bridge.js"></script>');
  if (!html.includes('gemini-key-settings.js')) scripts.push('<script src="./gemini-key-settings.js"></script>');
  if (!html.includes('paystub-history.js')) scripts.push('<script src="./paystub-history.js"></script>');
  if (!html.includes('week-tools.js')) scripts.push('<script src="./week-tools.js"></script>');
  if (!html.includes('week-direct-clear.js')) scripts.push('<script src="./week-direct-clear.js"></script>');
  if (scripts.length) html = html.replace('</body>', scripts.join('') + '</body>');

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
    url.pathname.endsWith('/rrq-fix.js') ||
    url.pathname.endsWith('/stats-projection-fix.js') ||
    url.pathname.endsWith('/payroll-settings-simulation.js') ||
    url.pathname.endsWith('/ai-assistant.js') ||
    url.pathname.endsWith('/menu-polish.js') ||
    url.pathname.endsWith('/ai-data-entry.js') ||
    url.pathname.endsWith('/navigation-recovery.js') ||
    url.pathname.endsWith('/gemini-assistant-bridge.js') ||
    url.pathname.endsWith('/gemini-key-settings.js') ||
    url.pathname.endsWith('/paystub-history.js') ||
    url.pathname.endsWith('/week-tools.js') ||
    url.pathname.endsWith('/week-direct-clear.js') ||
    url.pathname.endsWith('/service-worker.js');

  if (isHtml) {
    event.respondWith(
      fetch(req, { cache: 'reload' })
        .then(async (res) => {
          const fixed = await withExtraScripts(res.clone());
          const cacheCopy = fixed.clone();
          caches.open(CACHE).then((c) => c.put(req, cacheCopy)).catch(() => {});
          return fixed;
        })
        .catch(() => caches.match(req).then((r) => r ? withExtraScripts(r) : caches.match('./index.html').then((x) => x ? withExtraScripts(x) : x)))
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

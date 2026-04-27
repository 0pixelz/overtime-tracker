const CACHE = 'heures-sup-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './paystub-pdf.js',
  './paystub-ui.js'
];

const PDF_SCRIPTS = `
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
  </script>
  <script src="./paystub-pdf.js"></script>
  <script src="./paystub-ui.js"></script>
`;

async function injectPaystubScripts(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  if (!html.includes('paystub-ui.js')) {
    html = html.replace('</body>', `${PDF_SCRIPTS}\n</body>`);
  }

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache'
    }
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(async (res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return injectPaystubScripts(res);
        })
        .catch(() => caches.match(req).then(async (r) => {
          const fallback = r || await caches.match('./index.html');
          return fallback ? injectPaystubScripts(fallback) : fallback;
        }))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req)
          .then((res) => {
            if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached)
      );
    })
  );
});

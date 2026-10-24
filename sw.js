// Offline + speed. Every file of a release is saved in ONE cache when the app updates, then served from it instantly.
// tools/build.mjs stamps VERSION and the file list below on deploy. Unstamped (local development) it always asks the network first.
const VERSION = 'baithak-dev';
const PRECACHE = /*PRECACHE*/[];
const DEV = VERSION === 'baithak-dev';
const CDN = 'baithak-cdn';   // Firebase SDK files (their URLs contain the version, so they never change) and fonts

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => (DEV ? c.addAll(['./', 'index.html']).catch(() => {}) : c.addAll(PRECACHE)))   // all or nothing: a half-saved release is never used
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== CDN).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('slow')), ms); p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); }); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  const sdk = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!same && !sdk && !fonts) return;   // live data (Firebase database) never goes through here

  if (sdk || fonts) {   // saved on first use, then instant (fonts refresh quietly in the background)
    e.respondWith(caches.open(CDN).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    }));
    return;
  }
  if (req.mode === 'navigate') {   // the page itself: fresh if the network answers within 2.5 s, otherwise the saved copy
    e.respondWith(withTimeout(fetch(req), 2500).then((res) => { if (res.ok) caches.open(VERSION).then((c) => c.put('index.html', res.clone())); return res; })
      .catch(() => caches.match('index.html').then((h) => h || fetch(req))));
    return;
  }
  if (DEV) {   // development: network first so edits show up
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.open(VERSION).then(async (c) => {   // release files: straight from the cache
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res && res.ok) c.put(req, res.clone());
    return res;
  }));
});

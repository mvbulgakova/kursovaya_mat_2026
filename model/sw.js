// Service worker: сохраняет все файлы приложения, чтобы оно открывалось без интернета.
// VERSION при публикации заменяется на номер коммита, поэтому кэш обновляется сам.
// Список FILES должен быть полным — это проверяет тест.
const VERSION = 'v1';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/app.js',
  'js/core.js',
  'js/tasks.js',
  'js/util.js',
  'js/lib/qrcode.js',
  'js/lib/gl.js',
  'js/ui/plot2d.js',
  'js/ui/triangle-svg.js',
  'js/sections/home.js',
  'js/sections/secants.js',
  'js/sections/triangles.js',
  'js/sections/trainer.js',
  'js/sections/cubics.js',
  'js/sections/sphere.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// сначала кэш, затем сеть; новые ответы сети тоже кладём в кэш
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    if (hit) return hit;
    return fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
  }));
});

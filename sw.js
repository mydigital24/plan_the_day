const CACHE_NAME = 'structured-planner-v3';
const ASSETS = [
    './',
'./index.html',
'./style.css',
'./script.js',
'./manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => cache.addAll(ASSETS))
        .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
        .then(cachedResponse => cachedResponse || fetch(event.request))
    );
});

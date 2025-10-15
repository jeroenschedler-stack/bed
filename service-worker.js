// BED Hospitality 2.0 — basic PWA caching
const CACHE_NAME = "bed-cache-v1";
const urlsToCache = [
  "/bed/",
  "/bed/index.html",
  "/bed/team/index.html",
  "/bed/peer/index.html",
  "/bed/icons/icon-192.png",
  "/bed/icons/icon-512.png",
  "/bed/icons/manifest.webmanifest"
];

// install event — cache files
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// activate event — clear old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME)
            .map(k => caches.delete(k))
      );
    })
  );
});

// fetch event — serve from cache if possible
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

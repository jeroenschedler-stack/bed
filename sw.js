// sw.js (v2) — force update
const SW_VERSION = 'v2';

self.addEventListener('install', (event) => {
  // Immediately activate this new worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all clients under /bed/ right away
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // No custom caching — always network / default browser cache
  // This ensures fresh files after Clear & reset
});

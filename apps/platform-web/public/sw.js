// Apex Service Worker kill-switch: platform-web does not use a PWA service worker.
// Browsers that visited the apex prior to the platform-web / tenant-web split (#462)
// retained the legacy Workbox /sw.js registration; activating this script purges stale
// Workbox/MMS caches, unregisters the worker, and refreshes controlled tabs cleanly.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith("workbox-") || key.startsWith("mms-"))
            .map((key) => caches.delete(key)),
        );
      } catch {
        // Ignore CacheStorage errors in restricted contexts.
      }
      try {
        await self.registration.unregister();
      } catch {
        // Ignore unregister errors if already detached.
      }
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })(),
  );
});

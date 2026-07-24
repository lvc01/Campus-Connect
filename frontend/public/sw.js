/* Campus Connect service worker — minimal offline shell. */

const CACHE_NAME = "campus-connect-v1";
const STATIC_PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/maskable-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.addAll(STATIC_PRECACHE);
      } catch (err) {
        // Precache is best-effort; failures (e.g. during dev) shouldn't brick install.
        console.warn("sw: precache partial", err);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Skip Next internals, API, and analytics targets (always-network).
  const url = new URL(req.url);
  if (url.pathname.startsWith("/_next/")) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/uploads/")) return;

  // Network-first for HTML, cache fallback for everything else.
  const isHtml =
    req.headers.get("accept")?.includes("text/html") ||
    (req.mode === "navigate");

  if (isHtml) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(req);
          return cached || (await caches.match("/")) || Response.error();
        }
      })(),
    );
    return;
  }

  // Cache-first for static assets (icons, fonts, scripts).
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh.ok && (url.pathname.startsWith("/static/") || /\.(png|svg|js|css|woff2?)$/.test(url.pathname))) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })(),
  );
});

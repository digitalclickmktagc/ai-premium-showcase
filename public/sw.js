/*
 * Service worker for the Editorial Calendar PWA.
 *
 * Deliberately conservative so it never interferes with the marketing landing
 * page that shares this origin:
 *   - Only app navigations (/app, /c) are handled (network-first + offline
 *     fallback). The landing page ("/") is passed straight through.
 *   - Hashed build assets (/assets/, /icons/) use stale-while-revalidate; new
 *     deploys change filenames so stale content can't stick around.
 */
const VERSION = "v1";
const RUNTIME = `ec-runtime-${VERSION}`;
const SHELL_KEY = "app-shell";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("ec-") && k !== RUNTIME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const isAppNav =
    req.mode === "navigate" &&
    (url.pathname.startsWith("/app") || url.pathname.startsWith("/c"));

  // App navigations: try network, fall back to the cached shell when offline.
  if (isAppNav) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME);
          cache.put(SHELL_KEY, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(RUNTIME);
          const cached = await cache.match(SHELL_KEY);
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Hashed static assets: stale-while-revalidate.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
    return;
  }

  // Everything else (landing page, etc.): let the browser handle it.
});

/**
 * Finance Node service worker — 极简离线壳。
 * 仅缓存构建产物（JS/CSS/字体），不缓存 API 请求。
 */
const CACHE_VERSION = "finance-node-v2.1.0";
const STATIC_CACHE = `static-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.endsWith(CACHE_VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 永远不缓存 API
  if (url.pathname.startsWith("/v1/")) return;
  // 仅 GET
  if (request.method !== "GET") return;

  // 静态资源：cache-first
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // 其他（HTML、入口）走 network-first，失败回退缓存
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((r) => r || new Response("", { status: 504 }))),
  );
});

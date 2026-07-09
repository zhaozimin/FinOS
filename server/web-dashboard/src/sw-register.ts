/** Optional service worker registration — only in production. */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silently ignore — fallback is browser cache.
    });
  });
}

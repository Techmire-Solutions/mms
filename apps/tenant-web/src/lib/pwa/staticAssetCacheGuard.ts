/**
 * Workbox `cacheWillUpdate` guard for `/assets/*` and static asset runtime caching.
 *
 * Keeps `cacheWillUpdate` completely self-contained (zero outer closure bindings)
 * because Workbox `generateSW` serializes plugin functions directly into `sw.js`.
 * Rejects non-200 responses and any `text/html` fallback so a missing chunk or
 * upstream maintenance page can never poison `mms-static-assets` for 30 days.
 */
export function createStaticAssetMimeGuardPlugin() {
  return {
    cacheWillUpdate: async ({ response }: { request?: Request; response: Response }) => {
      if (!response || response.status !== 200) {
        return null;
      }
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("text/html")) {
        return null;
      }
      return response;
    },
  };
}

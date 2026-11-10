import { runAfterFirstPaint } from "./runAfterFirstPaint";

/**
 * Registers the PWA service worker after the first paint, ensuring that
 * service worker registration, script fetching, and cache updates
 * do not compete with initial paint resources.
 */
export function registerServiceWorkerDeferred(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  runAfterFirstPaint(() => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Non-fatal catch in unsupported/dev environments
    });
  });
}

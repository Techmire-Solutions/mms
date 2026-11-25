/**
 * Recovers from a stale-chunk load failure after a deploy.
 *
 * Vite emits a cancelable `vite:preloadError` event when a dynamic import (or a
 * modulepreload dependency of one) fails. In a hashed-chunk SPA with the PWA
 * service worker on `autoUpdate`, a tab that stays open across a deploy can ask
 * for a chunk revision that no longer exists — the route then dies inside
 * `React.lazy` and surfaces the root error boundary instead of recovering.
 *
 * Handling the event and reloading fetches the current `index.html` and its
 * chunk graph. A sessionStorage timestamp throttles the reload so a genuinely
 * broken build cannot trap the user in a reload loop: inside the window the
 * event is left unhandled, so Vite rethrows and the error boundary is shown.
 */

/** Vite's preload-error event name (cancelable). */
export const CHUNK_LOAD_ERROR_EVENT = "vite:preloadError";

/** sessionStorage key holding the last recovery reload timestamp. */
export const CHUNK_RELOAD_STORAGE_KEY = "mms:chunk-reload-at";

/** Minimum spacing between recovery reloads, in milliseconds. */
export const CHUNK_RELOAD_THROTTLE_MS = 10_000;

export interface ChunkLoadRecoveryDeps {
  /** Reloads the document. Defaults to `window.location.reload()`. */
  reload?: () => void;
  /** Current time source, injectable for tests. */
  now?: () => number;
  /** Timestamp storage, injectable for tests. */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  /** Event target that receives `vite:preloadError`. Defaults to `window`. */
  target?: EventTarget;
}

function safeSessionStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return window.sessionStorage;
  } catch {
    // Storage can throw in private modes / blocked-cookie contexts.
    return null;
  }
}

function readTimestamp(storage: ChunkLoadRecoveryDeps["storage"]): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CHUNK_RELOAD_STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeTimestamp(storage: ChunkLoadRecoveryDeps["storage"], value: number): void {
  if (!storage) return;
  try {
    storage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(value));
  } catch {
    // A failed write only weakens the loop guard; never block recovery on it.
  }
}

/**
 * Installs the recovery listener and returns an uninstall function.
 * No-op outside a browser (SSR/test environments without `window`).
 */
export function installChunkLoadRecovery(deps: ChunkLoadRecoveryDeps = {}): () => void {
  if (typeof window === "undefined") return () => undefined;

  const target = deps.target ?? window;
  const now = deps.now ?? (() => Date.now());
  const reload = deps.reload ?? (() => window.location.reload());
  const storage = deps.storage === undefined ? safeSessionStorage() : deps.storage;

  const handler = (event: Event): void => {
    const at = now();
    const last = readTimestamp(storage);
    if (last !== null && at - last < CHUNK_RELOAD_THROTTLE_MS) {
      // Too soon: leave the event unhandled so Vite rethrows and the error
      // boundary surfaces instead of a blank route.
      return;
    }
    event.preventDefault();
    writeTimestamp(storage, at);
    reload();
  };

  target.addEventListener(CHUNK_LOAD_ERROR_EVENT, handler);
  return () => target.removeEventListener(CHUNK_LOAD_ERROR_EVENT, handler);
}

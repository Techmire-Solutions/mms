/**
 * Recovers from a stale-chunk load failure after a deploy and provides
 * legacy Service Worker / CacheStorage eviction helpers.
 *
 * Vite emits a cancelable `vite:preloadError` event when a dynamic import (or a
 * modulepreload dependency of one) fails. In a hashed-chunk SPA, a tab that
 * stays open across a deploy — or a browser with a stale Service Worker cache —
 * can ask for a chunk revision that no longer exists.
 *
 * Handling the event purges stale runtime asset/HTML caches, nudges active SW
 * registrations to update, and reloads once to fetch the current `index.html`
 * and chunk graph. A sessionStorage timestamp throttles reloads so a genuinely
 * broken build cannot trap the user in a reload loop.
 */

/** Vite's preload-error event name (cancelable). */
export const CHUNK_LOAD_ERROR_EVENT = "vite:preloadError";

/** sessionStorage key holding the last recovery reload timestamp. */
export const CHUNK_RELOAD_STORAGE_KEY = "mms:chunk-reload-at";

/** Minimum spacing between recovery reloads, in milliseconds. */
export const CHUNK_RELOAD_THROTTLE_MS = 10_000;

/** Maximum wait for pre-reload SW/cache maintenance before forcing reload. */
const RECOVERY_CLEANUP_TIMEOUT_MS = 1_500;

const RUNTIME_CACHE_NAMES = new Set(["mms-static-assets", "mms-html-manifest"]);

export interface SwRegistrationLike {
  update?: () => Promise<unknown>;
  unregister?: () => Promise<boolean>;
}

export interface ServiceWorkerContainerLike {
  getRegistrations: () => Promise<readonly SwRegistrationLike[]>;
}

export interface CacheStorageLike {
  keys: () => Promise<readonly string[]>;
  delete: (cacheName: string) => Promise<boolean>;
}

export interface ChunkLoadRecoveryDeps {
  /** Reloads the document. Defaults to `window.location.reload()`. */
  reload?: () => void;
  /** Current time source, injectable for tests. */
  now?: () => number;
  /** Timestamp storage, injectable for tests. */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  /** Event target that receives `vite:preloadError`. Defaults to `window`. */
  target?: EventTarget;
  /** Service worker container for registration updates, injectable for tests. */
  serviceWorker?: ServiceWorkerContainerLike | null;
  /** CacheStorage handle for clearing stale runtime caches, injectable for tests. */
  caches?: CacheStorageLike | null;
}

function safeSessionStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return window.sessionStorage;
  } catch {
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

function resolveDefaultServiceWorker(
  deps: ChunkLoadRecoveryDeps,
): ServiceWorkerContainerLike | null {
  if (deps.serviceWorker !== undefined) return deps.serviceWorker;
  if (deps.target !== undefined) return null;
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    return navigator.serviceWorker;
  }
  return null;
}

function resolveDefaultCaches(deps: ChunkLoadRecoveryDeps): CacheStorageLike | null {
  if (deps.caches !== undefined) return deps.caches;
  if (deps.target !== undefined) return null;
  if (typeof globalThis.caches !== "undefined") {
    return globalThis.caches;
  }
  return null;
}

async function refreshRuntimeCachesAndWorkers(
  sw: ServiceWorkerContainerLike | null,
  cacheStorage: CacheStorageLike | null,
): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (cacheStorage) {
    tasks.push(
      cacheStorage
        .keys()
        .then((keys) =>
          Promise.allSettled(
            keys
              .filter((key) => RUNTIME_CACHE_NAMES.has(key))
              .map((key) => cacheStorage.delete(key)),
          ),
        ),
    );
  }

  if (sw) {
    tasks.push(
      sw.getRegistrations().then((regs) => Promise.allSettled(regs.map((reg) => reg.update?.()))),
    );
  }

  if (tasks.length === 0) return;

  await Promise.race([
    Promise.allSettled(tasks),
    new Promise<void>((resolve) => setTimeout(resolve, RECOVERY_CLEANUP_TIMEOUT_MS)),
  ]);
}

/**
 * Unregisters all Service Workers and purges Workbox/MMS caches on origins
 * that do not run a PWA Service Worker (such as the platform apex).
 */
export async function cleanupLegacyServiceWorkers(
  options: {
    serviceWorker?: ServiceWorkerContainerLike | null;
    caches?: CacheStorageLike | null;
  } = {},
): Promise<void> {
  const sw =
    options.serviceWorker !== undefined
      ? options.serviceWorker
      : typeof navigator !== "undefined" && "serviceWorker" in navigator
        ? navigator.serviceWorker
        : null;
  const cacheStorage =
    options.caches !== undefined
      ? options.caches
      : typeof globalThis.caches !== "undefined"
        ? globalThis.caches
        : null;

  const tasks: Promise<unknown>[] = [];
  if (sw) {
    tasks.push(
      sw
        .getRegistrations()
        .then((regs) => Promise.allSettled(regs.map((reg) => reg.unregister?.()))),
    );
  }
  if (cacheStorage) {
    tasks.push(
      cacheStorage
        .keys()
        .then((keys) =>
          Promise.allSettled(
            keys
              .filter((key) => key.startsWith("workbox-") || key.startsWith("mms-"))
              .map((key) => cacheStorage.delete(key)),
          ),
        ),
    );
  }
  await Promise.allSettled(tasks);
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
  const sw = resolveDefaultServiceWorker(deps);
  const cacheStorage = resolveDefaultCaches(deps);

  const handler = (event: Event): void => {
    const at = now();
    const last = readTimestamp(storage);
    if (last !== null && at - last < CHUNK_RELOAD_THROTTLE_MS) {
      return;
    }
    event.preventDefault();
    writeTimestamp(storage, at);

    if (!sw && !cacheStorage) {
      reload();
      return;
    }

    void refreshRuntimeCachesAndWorkers(sw, cacheStorage).finally(() => {
      reload();
    });
  };

  target.addEventListener(CHUNK_LOAD_ERROR_EVENT, handler);
  return () => target.removeEventListener(CHUNK_LOAD_ERROR_EVENT, handler);
}

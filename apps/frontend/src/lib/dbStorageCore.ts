import { apiFetch } from "@/lib/apiClient";
import { tenantLocalStoragePrefix } from "@mms/shared";
import { getCurrentSubdomain } from "@/lib/config/tenantConfig";
import { reportClientError, reportClientWarn } from "@/lib/clientErrorReporting";

export function getWorkspaceLocalStoragePrefix(): string {
  const subdomain = getCurrentSubdomain();
  return subdomain ? tenantLocalStoragePrefix(subdomain) : "mms_";
}

export function getStoragePrefix(): string {
  return getWorkspaceLocalStoragePrefix();
}

export function scopedStorageKey(key: string): string {
  return `${getStoragePrefix()}${key}`;
}

// ─── Sync Status ─────────────────────────────────────────────────────────────

/** Possible states of the background server synchronization. */
export type SyncStatus = "idle" | "syncing" | "error";

let _syncStatus: SyncStatus = "idle";

/**
 * Returns the current background sync status.
 *
 * @returns {SyncStatus} The current sync status.
 */
export function getSyncStatus(): SyncStatus {
  return _syncStatus;
}

export function setSyncStatus(status: SyncStatus): void {
  _syncStatus = status;
  if (typeof window !== "undefined") {
    // Defer so saveObject during render (e.g. widget seed load) cannot update SyncStatusBadge mid-render.
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent("sync-status-change", { detail: status }));
    });
  }
}

export function getHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
  };
}

/**
 * Performs a background write to the server and tracks sync status.
 *
 * @param {string} url - API endpoint URL.
 * @param {unknown} body - Object or Array to send.
 * @returns {Promise<void>}
 */
export interface ServerSyncResult {
  ok: boolean;
  status?: number;
  /** Translation key when the API returns a `backup.*` message. */
  errorKey?: string;
}

export async function syncToServer(
  url: string,
  body: unknown,
  method: string = "POST",
  options?: { signal?: AbortSignal },
): Promise<ServerSyncResult> {
  try {
    setSyncStatus("syncing");
    const response = await apiFetch(url, {
      method,
      headers: getHeaders(),
      body: JSON.stringify(body),
      signal: options?.signal,
    });
    if (!response.ok) {
      const isAuthFailure = response.status === 401 || response.status === 403;
      const expectedPreAuth = response.status === 401 && localStorage.getItem("mms_user") === null;
      if (!expectedPreAuth && !isAuthFailure) {
        reportClientWarn(
          new Error(`Sync to server failed for ${url} (status: ${response.status})`),
          { context: "db.syncToServer", url, status: response.status },
        );
      }
      setSyncStatus(expectedPreAuth || isAuthFailure ? "idle" : "error");
      let errorKey: string | undefined;
      try {
        const payload = (await response.json()) as { message?: unknown; error?: unknown };
        if (typeof payload.message === "string" && payload.message.trim().length > 0) {
          errorKey = payload.message;
        } else if (typeof payload.error === "string" && payload.error.trim().length > 0) {
          errorKey = payload.error;
        }
      } catch {
        // Ignore non-JSON error bodies.
      }
      return { ok: false, status: response.status, errorKey };
    }
    setSyncStatus("idle");
    return { ok: true };
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") {
      setSyncStatus("idle");
      return { ok: false };
    }
    reportClientError(error, { context: "db.syncToServer", url });
    setSyncStatus("error");
    return { ok: false };
  }
}

/**
 * Downloads the authoritative tenant snapshot from PostgreSQL (admin-only).
 */
export function dispatchLocalDatabaseUpdate(): void {
  if (typeof window !== "undefined") {
    setTimeout(() => {
      window.dispatchEvent(new Event("local-database-update"));
    }, 0);
  }
}

/**
 * Safely writes a key-value pair to localStorage, handling quota exceptions.
 */
export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    reportClientWarn(err, { context: "db.safeSetItem", key });
  }
}

/**
 * Removes all keys starting with the specified prefix from localStorage.
 */
export function clearByPrefix(prefix: string): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

/**
 * Wipes all application localStorage and sessionStorage keys.
 * Called when platform database reset or full workspace wipes occur to guarantee zero client cache leaks.
 */
export function clearAllClientStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (err) {
    reportClientWarn(err, { context: "db.clearClientStorage" });
  }
}

/**
 * Writes a server snapshot into the scoped localStorage cache.
 */

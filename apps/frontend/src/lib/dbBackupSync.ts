import { apiFetch } from "@/lib/apiClient";
import { reportClientError } from "@/lib/clientErrorReporting";
import {
  buildWorkspaceBackupEnvelopeAsync,
  buildStorageKeysFromSnapshot,
  parseStorageKeysToSnapshot,
  validateWorkspaceBackupJsonAsync,
  encryptWorkspaceBackup,
  type TenantDatabaseSnapshot,
  type BackupCredentials,
  type WorkspaceBackupStats,
  type WorkspaceBackupEnvelope,
} from "@mms/shared";
import { getCurrentSubdomain } from "@/lib/config/tenantConfig";
import {
  clearByPrefix,
  dispatchLocalDatabaseUpdate,
  getHeaders,
  getStoragePrefix,
  safeSetItem,
  syncToServer,
} from "@/lib/dbStorageCore";

async function fetchSnapshot(path: string): Promise<TenantDatabaseSnapshot> {
  const response = await apiFetch(path, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("backup.serverForbidden");
    }
    throw new Error("backup.serverFetchFailed");
  }

  return (await response.json()) as TenantDatabaseSnapshot;
}

export async function fetchTenantSnapshot(): Promise<TenantDatabaseSnapshot> {
  return fetchSnapshot("/api/db/sync");
}

/**
 * Full-fidelity snapshot for backup export — includes the relational tables that
 * own REST-migrated module data, which `/api/db/sync` does not carry.
 */
export async function fetchTenantBackupSnapshot(): Promise<TenantDatabaseSnapshot> {
  return fetchSnapshot("/api/db/backup");
}

/**
 * Writes a server snapshot into the scoped localStorage cache.
 */
export function applySnapshotToLocalCache(snapshot: TenantDatabaseSnapshot): void {
  const prefix = getStoragePrefix();
  clearByPrefix(prefix);
  const keys = buildStorageKeysFromSnapshot(snapshot, prefix);
  for (const [key, value] of Object.entries(keys)) {
    safeSetItem(key, value);
  }

  dispatchLocalDatabaseUpdate();
}

/**
 * Performs a complete synchronization pull from the backend.
 * Downloads all collections and objects, updates the local cache, and notifies observers.
 *
 * @returns {Promise<void>}
 */
export async function syncDatabase(): Promise<void> {
  try {
    const tenantSnapshot = await fetchTenantSnapshot();
    applySnapshotToLocalCache(tenantSnapshot);
  } catch (error) {
    reportClientError(error, { context: "db.syncDatabase" });
  }
}

/**
 * Exports a full tenant backup from the server (PostgreSQL), not browser cache alone.
 * The local cache is left untouched — a full workspace can exceed the localStorage quota.
 */
export async function exportTenantBackup(): Promise<string> {
  const snapshot = await fetchTenantBackupSnapshot();

  const prefix = getStoragePrefix();
  const keys = buildStorageKeysFromSnapshot(snapshot, prefix);
  const subdomain = getCurrentSubdomain();

  return await buildWorkspaceBackupEnvelopeAsync(keys, { subdomain, dataSource: "server" });
}

export async function importDatabase(jsonString: string): Promise<void> {
  try {
    const prefix = getStoragePrefix();
    // Enforce workspace match at the API boundary so a foreign workspace's
    // payload can never be restored into the current tenant, regardless of caller.
    const validated = await validateWorkspaceBackupJsonAsync(
      jsonString,
      prefix,
      getCurrentSubdomain(),
    );
    if (!validated.ok) {
      throw new Error(validated.errorKey);
    }

    const { collections, objects } = parseStorageKeysToSnapshot(validated.data, prefix);

    // Pushes backup bulk sync to backend first. If this fails, the local cache remains untouched.
    const result = await syncToServer("/api/db/sync", { collections, objects });
    if (!result.ok) {
      // A timed-out restore is rolled back server-side, so the local cache stays valid.
      if (result.status === 408) {
        throw new Error("backup.syncTimeout");
      }
      throw new Error(result.errorKey ?? "backup.serverRestoreFailed");
    }

    // Drop the stale local cache. Do not rewrite the full relational dump into
    // localStorage — it can exceed quota, and the page reload rehydrates via REST.
    clearByPrefix(prefix);

    // Keep settings/singleton objects cached so the first paint after reload is coherent.
    if (objects) {
      for (const [logicalKey, value] of Object.entries(objects)) {
        safeSetItem(`${prefix}${logicalKey}`, JSON.stringify(value));
      }
    }

    dispatchLocalDatabaseUpdate();
  } catch (error) {
    reportClientError(error, { context: "db.importDatabase" });
    throw error;
  }
}

/**
 * Exports a full tenant backup from the server (PostgreSQL) and encrypts it using admin credentials.
 */
export async function exportEncryptedTenantBackup(
  credentials: BackupCredentials,
  tenantLabel: string,
): Promise<{ encrypted: string; stats: WorkspaceBackupStats }> {
  const plaintext = await exportTenantBackup();
  const envelope = JSON.parse(plaintext) as WorkspaceBackupEnvelope;
  const subdomain = getCurrentSubdomain();
  const encrypted = await encryptWorkspaceBackup(plaintext, credentials, {
    subdomain,
    tenantLabel,
  });
  return { encrypted, stats: envelope.stats };
}

import { type TenantDatabaseSnapshot } from "@mms/shared";
import { getAllData as dbGetAllData, runInReadSnapshotTransaction } from "../db/database.js";
import { loadRelationalSnapshotCollections } from "../db/relationalSnapshot.js";
import { getRequestTenant } from "../lib/tenantContext.js";
import { maskGlobalSettingsForClient } from "./globalSettingsService.js";

/**
 * Fetches workspace branding and global settings concurrently for a tenant.
 */
async function fetchTenantMetadata(tenant: string) {
  const { getWorkspaceBranding, getWorkspaceGlobalSettings } =
    await import("../db/repositories/workspaceRepository.js");
  const [branding, globalSettings] = await Promise.all([
    getWorkspaceBranding(tenant),
    getWorkspaceGlobalSettings(tenant),
  ]);
  return { branding, globalSettings };
}

/**
 * Retrieves a client-facing snapshot of all database collections and objects.
 * Masks LLM provider secrets via maskGlobalSettingsForClient.
 *
 * @returns {Promise<TenantDatabaseSnapshot>} The client-safe database sync snapshot.
 */
export async function fetchDatabaseSnapshot(): Promise<TenantDatabaseSnapshot> {
  const snapshot = await dbGetAllData();
  const tenant = getRequestTenant();
  if (!tenant) return snapshot;

  const { branding, globalSettings } = await fetchTenantMetadata(tenant);

  return {
    ...snapshot,
    objects: {
      ...(snapshot.objects ?? {}),
      ...(branding ? { branding } : {}),
      ...(globalSettings ? { global_settings: maskGlobalSettingsForClient(globalSettings) } : {}),
    },
  };
}

/**
 * Retrieves a full-fidelity workspace snapshot for backup export.
 *
 * Combines tenant doc-store collections/objects with authoritative relational tables
 * inside a single REPEATABLE READ transaction to avoid cross-store torn reads.
 * Preserves full global settings (unmasked) and packages uploaded backup assets.
 *
 * @returns {Promise<TenantDatabaseSnapshot>} The full backup snapshot.
 */
export async function fetchBackupSnapshot(): Promise<TenantDatabaseSnapshot> {
  return await runInReadSnapshotTransaction(async () => {
    const snapshot = await dbGetAllData();
    const tenant = getRequestTenant();
    if (!tenant) return snapshot;

    const { loadEmailIntegrationConfig } = await import("./email/emailIntegrationService.js");
    const [relational, { branding, globalSettings }, emailIntegration] = await Promise.all([
      loadRelationalSnapshotCollections(tenant),
      fetchTenantMetadata(tenant),
      loadEmailIntegrationConfig(),
    ]);

    const snapshotPayload: TenantDatabaseSnapshot = {
      ...snapshot,
      collections: { ...(snapshot.collections ?? {}), ...relational },
      objects: {
        ...(snapshot.objects ?? {}),
        ...(branding ? { branding } : {}),
        ...(globalSettings ? { global_settings: globalSettings } : {}),
        ...(emailIntegration ? { email_integration: emailIntegration } : {}),
      },
    };

    const { exportBackupAssetsForSnapshot } = await import("./backupAssetService.js");
    const assets = await exportBackupAssetsForSnapshot(snapshotPayload);

    return {
      ...snapshotPayload,
      ...(Object.keys(assets).length > 0 ? { assets } : {}),
    };
  });
}

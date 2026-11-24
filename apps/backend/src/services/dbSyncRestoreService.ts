import {
  isBackupExcludedObjectKey,
  isServerOnlyObjectKey,
  BACKUP_EPHEMERAL_OBJECT_KEYS,
  type TenantDatabaseSnapshot,
} from "@mms/contracts";
import {
  deleteCollection as dbDeleteCollection,
  saveCollection as dbSaveCollection,
  saveObject as dbSaveObject,
  deleteObject as dbDeleteObject,
  listTenantObjectLogicalKeys as dbListTenantObjectLogicalKeys,
  listTenantCollectionLogicalKeys as dbListTenantCollectionLogicalKeys,
  runInGlobalTransaction,
  runInTransaction,
} from "../db/database.js";
import { activeDb } from "@mms/db/client";
import { sql } from "drizzle-orm";
import {
  sortCollectionNamesForRestore,
  withCompleteRelationalRestoreCollections,
} from "../db/relationalReplaceMapping.js";
import {
  hydrateStudentsSetupCollectionsFromLegacyObjects,
  STUDENTS_LEGACY_SETUP_OBJECT_KEYS,
} from "../db/migrations/hydrateStudentsSetupFromLegacyBackup.js";
import {
  hydrateFacultySetupCollectionsFromLegacyObjects,
  FACULTY_LEGACY_SETUP_OBJECT_KEYS,
} from "../db/migrations/hydrateFacultySetupFromLegacyBackup.js";
import { getRequestTenant } from "../lib/tenantContext.js";
import { isAdminRole, isSuperAdminRole } from "@mms/contracts";
import { throwIfSyncAborted } from "../lib/syncLimits.js";
import { acquireTenantRestoreLock, RestoreInProgressError } from "../lib/restoreLock.js";
import { clearTenantBackgroundJobs } from "./backgroundJobService.js";

const ALL_LEGACY_SETUP_OBJECT_KEYS = [
  ...STUDENTS_LEGACY_SETUP_OBJECT_KEYS,
  ...FACULTY_LEGACY_SETUP_OBJECT_KEYS,
] as const;

function hydrateLegacySetupCollections(
  collections: Record<string, unknown[]> | undefined,
  objects: Record<string, unknown> | undefined,
): Record<string, unknown[]> {
  const studentsHydrated = hydrateStudentsSetupCollectionsFromLegacyObjects(
    { ...(collections ?? {}) },
    objects,
  );
  return hydrateFacultySetupCollectionsFromLegacyObjects(studentsHydrated, objects);
}

async function restoreSpecialTenantObject(
  key: string,
  objectValue: unknown,
  tenant: string,
): Promise<void> {
  if (typeof objectValue !== "object" || objectValue === null || Array.isArray(objectValue)) {
    return;
  }
  const record = objectValue as Record<string, unknown>;

  if (key === "branding") {
    const { upsertWorkspaceBranding } = await import("../db/repositories/workspaceRepository.js");
    const { mergeBrandingSettings } = await import("@mms/contracts");
    // A restore may rebuild branding but must not rename the madrasa: the name is
    // platform-owned and only the platform console can change it.
    await upsertWorkspaceBranding(tenant, mergeBrandingSettings(record), {
      preserveMadrasaName: true,
    });
  } else if (key === "global_settings") {
    const { upsertWorkspaceGlobalSettings } =
      await import("../db/repositories/workspaceRepository.js");
    const { mergeGlobalSettings } = await import("@mms/contracts");
    await upsertWorkspaceGlobalSettings(tenant, mergeGlobalSettings(record));
    const { broadcastTenantUpdate } = await import("../lib/livePush.js");
    broadcastTenantUpdate(tenant, "object", "global_settings");
  } else if (key === "email_integration") {
    const { saveEmailIntegrationConfig } = await import("./email/emailIntegrationService.js");
    const { mergeEmailIntegrationConfig } = await import("@mms/contracts");
    await saveEmailIntegrationConfig(mergeEmailIntegrationConfig(record));
  }
}

async function verifyPostRestoreIntegrity(subdomain: string): Promise<void> {
  const { listAllTenantUsersByWorkspace } =
    await import("../db/repositories/tenantUserRepository.js");
  const users = await listAllTenantUsersByWorkspace(subdomain);
  if (users.length > 0) {
    const hasAdmin = users.some(
      (u) => (isAdminRole(u.role) || isSuperAdminRole(u.role)) && !u.deletedAt,
    );
    if (!hasAdmin) {
      throw new Error("backup.missingAdminUser");
    }
  }
}

/**
 * Performs an atomic, synchronized batch write of collections and objects in one transaction.
 *
 * @param {TenantDatabaseSnapshot} payload - The snapshot payload with collections, objects, and optional assets.
 * @param {AbortSignal} [signal] - Optional abort signal to terminate mid-restore and trigger transaction rollback.
 * @param {boolean} [fullRestore=false] - When true, prunes unmentioned collections/objects, clears jobs, and verifies admin presence.
 * @returns {Promise<void>}
 */
export async function synchronizeData(
  payload: TenantDatabaseSnapshot,
  signal?: AbortSignal,
  fullRestore = false,
): Promise<void> {
  const collections = withCompleteRelationalRestoreCollections(
    fullRestore
      ? hydrateLegacySetupCollections(payload.collections, payload.objects)
      : payload.collections,
  );
  const { objects } = payload;
  const skipLegacySetupObjects = new Set<string>(fullRestore ? ALL_LEGACY_SETUP_OBJECT_KEYS : []);

  const restoredCollectionKeys = new Set<string>();

  // Tenant-scoped restore when a workspace is bound (the normal case); an
  // explicit whole-database restore only when none is — never an implicit
  // RLS bypass (runInTransaction now fails closed on a missing tenant).
  const runRestore = getRequestTenant() ? runInTransaction : runInGlobalTransaction;

  await runRestore(async () => {
    const tenant = getRequestTenant();
    if (tenant && !(await acquireTenantRestoreLock(tenant))) {
      throw new RestoreInProgressError();
    }

    await activeDb().execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);

    if (fullRestore) {
      await clearTenantBackgroundJobs();
      collections.backups = [];
    }

    for (const name of sortCollectionNamesForRestore(Object.keys(collections))) {
      throwIfSyncAborted(signal);
      const collectionItems = collections[name];
      if (Array.isArray(collectionItems)) {
        await dbSaveCollection(name, collectionItems, { mirrorRelationalReplace: true });
        restoredCollectionKeys.add(name);
      }
    }

    if (fullRestore) {
      for (const key of await dbListTenantCollectionLogicalKeys()) {
        throwIfSyncAborted(signal);
        if (!restoredCollectionKeys.has(key)) await dbDeleteCollection(key);
      }
    }

    if (objects) {
      const restoredKeys = new Set<string>();
      for (const [key, objectValue] of Object.entries(objects)) {
        throwIfSyncAborted(signal);
        if (isServerOnlyObjectKey(key)) continue;
        if (isBackupExcludedObjectKey(key)) continue;
        if (skipLegacySetupObjects.has(key)) continue;

        if (tenant) {
          await restoreSpecialTenantObject(key, objectValue, tenant);
        }
        // branding/global_settings are persisted to typed columns by
        // restoreSpecialTenantObject; their legacy document-store copies are
        // no longer written.
        if (key !== "branding" && key !== "global_settings") {
          await dbSaveObject(key, objectValue);
        }
        restoredKeys.add(key);
      }

      if (fullRestore) {
        for (const key of await dbListTenantObjectLogicalKeys()) {
          throwIfSyncAborted(signal);
          if (!restoredKeys.has(key)) await dbDeleteObject(key);
        }
        for (const key of BACKUP_EPHEMERAL_OBJECT_KEYS) {
          await dbDeleteObject(key);
        }
      }
    } else if (fullRestore) {
      for (const key of BACKUP_EPHEMERAL_OBJECT_KEYS) {
        await dbDeleteObject(key);
      }
    }

    if (fullRestore && tenant) {
      await verifyPostRestoreIntegrity(tenant);
    }

    if (
      payload.assets &&
      typeof payload.assets === "object" &&
      Object.keys(payload.assets).length > 0
    ) {
      const { restoreTenantAssets } = await import("./backupAssetService.js");
      await restoreTenantAssets(payload.assets);
    }
  });
}

/**
 * Tenant-scoped localStorage database layer + background `/api/db` sync.
 * Prefer TanStack Query + REST for module CRUD; use this for settings/legacy local writes.
 */
export {
  getWorkspaceLocalStoragePrefix,
  getSyncStatus,
  clearAllClientStorage,
  type SyncStatus,
  type ServerSyncResult,
} from "@/lib/dbStorageCore";
export { syncDatabase, importDatabase, exportEncryptedTenantBackup } from "@/lib/dbBackupSync";
export {
  hasCollectionInCache,
  saveCollectionCacheOnly,
  getCollection,
  saveCollection,
  saveCollectionAsync,
} from "@/lib/dbCollections";
export {
  getObject,
  getGlobalSettings,
  mergeGlobalSettingsPreview,
  clearGlobalSettingsPreviewOverlay,
  getEffectiveGlobalSettings,
  saveGlobalSettings,
  saveGlobalSettingsAsync,
  getBrandingSettings,
  mergeBrandingSettingsPreview,
  clearBrandingSettingsPreviewOverlay,
  getEffectiveBrandingSettings,
  saveBrandingSettings,
  readObjectLocal,
  cachePublicBranding,
  saveObject,
  saveObjectAsync,
} from "@/lib/dbObjects";

export { formatDate } from "@mms/shared";

// Side-effect: wire shared date formatters to effective global settings (incl. preview).
import "@/lib/dbObjects";

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
} from "@/lib/dbStorageCore.js";
export { syncDatabase, importDatabase, exportEncryptedTenantBackup } from "@/lib/dbBackupSync.js";
export {
  hasCollectionInCache,
  saveCollectionCacheOnly,
  getCollection,
  saveCollection,
  saveCollectionAsync,
} from "@/lib/dbCollections.js";
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
} from "@/lib/dbObjects.js";

export { formatDate } from "@mms/shared";

// Side-effect: wire shared date formatters to effective global settings (incl. preview).
import "@/lib/dbObjects.js";

/**
 * Tenant-scoped localStorage database layer + background `/api/db` sync.
 * Prefer TanStack Query + REST for module CRUD; use this for settings/legacy local writes.
 */
export {
  getWorkspaceLocalStoragePrefix,
  getSyncStatus,
  type SyncStatus,
  type ServerSyncResult,
} from "@mms/fe-core/storage/dbStorageCore";
export { importDatabase, exportEncryptedTenantBackup } from "@mms/fe-core/lib/dbBackupSync";
export {
  hasCollectionInCache,
  saveCollectionCacheOnly,
  getCollection,
  saveCollection,
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
} from "@mms/fe-core/lib/dbObjects";

// Side-effect: wire shared date formatters to effective global settings (incl. preview).
import "@mms/fe-core/lib/dbObjects";

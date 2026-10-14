/**
 * Tenant-scoped localStorage database layer + background `/api/db` sync.
 * Prefer TanStack Query + REST for module CRUD; use this for settings/legacy local writes.
 */
export {
  getWorkspaceLocalStoragePrefix,
  getSyncStatus,
  type SyncStatus,
  type ServerSyncResult,
} from "@/lib/dbStorageCore";
export { importDatabase, exportEncryptedTenantBackup } from "@/lib/dbBackupSync";
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
} from "@/lib/dbObjects";

// Side-effect: wire shared date formatters to effective global settings (incl. preview).
import "@/lib/dbObjects";

/**
 * Backup/sync support owned by the kernel: credential stripping, the asset/settings
 * seams, the snapshot JSON generator, the legacy document store and the repository
 * loader port it needs (docs/monorepo-migration-plan.md U23, P1b-3).
 */
export {
  DocumentStoreRepositoryLoaderNotConfiguredError,
  configureDocumentStoreRepositoryLoader,
  loadDocumentStoreRepository,
} from "./documentStoreRepositoryLoader.js";
export type { DocumentStoreRepositoryLoader } from "./documentStoreRepositoryLoader.js";
export { stripCredentials } from "./stripCredentials.js";
export type { SnapshotAssetSource } from "./snapshotAssetSource.js";
export { streamSnapshotAssets } from "./snapshotAssetSource.js";
export type { SnapshotSettingsSource } from "./snapshotSettingsSource.js";
export {
  generateSnapshotJsonFromSource,
  materializeSnapshotFromSource,
  shouldIncludeCollectionKey,
  shouldIncludeObjectKey,
} from "./streamingSnapshotJson.js";
export type { SnapshotJsonSource } from "./streamingSnapshotJson.js";
export * from "./documentStore.js";
export * from "./dbPurge.js";
export * from "./streamingSnapshotProducer.js";

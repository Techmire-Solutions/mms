/** Tenant JSON document store — collections, objects, and admin storage helpers. */
export { getQueryRows } from "./documentStoreKeys.js";
export {
  getCollection,
  getCollectionForUpdate,
  saveCollection,
  deleteCollection,
  type SaveCollectionOptions,
} from "./documentStoreCollections.js";
export { getObject, saveObject, deleteObject } from "./documentStoreObjects.js";
export {
  getAllData,
  listCollectionStorageNames,
  getCollectionByStorageName,
  deleteCollectionByStorageName,
  deleteObjectByStorageKey,
  listObjectStorageKeys,
  listTenantObjectLogicalKeys,
  listTenantCollectionLogicalKeys,
  getObjectByStorageKey,
} from "./documentStoreAdmin.js";

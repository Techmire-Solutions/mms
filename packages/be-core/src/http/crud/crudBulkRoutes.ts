export type {
  BulkRoutesOptions,
  SoftDeleteRouteErrorMapper,
  SoftDeletableBulkRoutesOptions,
  SoftDeletableBulkTrashRoutesOptions,
} from "./crudBulkRouteHelpers.js";
export {
  registerBulkRoutes,
  registerIncludableBulkRoutes,
  registerSoftDeletableBulkTrashRoutes,
  registerSoftDeletableBulkRoutes,
} from "./crudBulkRouteFactories.js";

/** Shared Fastify CRUD / bulk / metrics route registrars for tenant modules. */
export type { ResourceRecord } from "./crudRouterTypes.js";
export {
  registerBulkRoutes,
  registerIncludableBulkRoutes,
  registerSoftDeletableBulkRoutes,
  registerSoftDeletableBulkTrashRoutes,
  type BulkRoutesOptions,
  type SoftDeleteRouteErrorMapper,
  type SoftDeletableBulkRoutesOptions,
  type SoftDeletableBulkTrashRoutesOptions,
} from "./crudBulkRoutes.js";
export {
  registerResourceRoutes,
  registerSingleRestoreRoute,
  registerSingleDeleteRoute,
  type ResourceRoutesOptions,
  type SingleRestoreRouteOptions,
  type SingleDeleteRouteOptions,
} from "./crudResourceRoutes.js";
export {
  registerMetricsRoute,
  registerCountRoute,
  registerResolveRoute,
  registerWidgetAggregatesRoute,
  registerLinkedContactIdsRoute,
  registerBulkPutRoute,
  type MetricsRouteOptions,
  type CountRouteOptions,
  type ResolveRouteOptions,
  type WidgetAggregatesRouteOptions,
  type LinkedContactIdsRouteOptions,
  type BulkPutRouteOptions,
} from "./crudQueryRoutes.js";
export {
  registerPaginatedListRoute,
  type PaginatedListRouteOptions,
} from "./crudPaginatedRoutes.js";
export {
  registerStandardExtendedRoutes,
  registerStandardTenantRoutes,
  type StandardExtendedRoutesOptions,
  type StandardTenantRoutesOptions,
} from "./crudStandardRoutes.js";

import { configureContactsKernelDeps } from "../deps.js";

/**
 * Test-only default kernel deps. Unit suites that exercise use-case logic mock
 * the repositories/ports they care about; this keeps the remaining deps
 * (workspace branding, job queue, storage, prepared statements, document store)
 * inert instead of throwing "deps not configured". A suite that needs a
 * different behaviour mocks `../deps.js` itself.
 */
configureContactsKernelDeps({
  getLinkedContactId: async () => null,
  enqueueBackgroundJob: async () => ({ id: "test-job" }),
  getUserBackgroundJob: async () => null,
  hasBackgroundJobRunner: () => false,
  registerBackgroundJobRunner: () => {},
  resolveTenantExportKey: (tenantId: string, filename: string) => `${tenantId}/${filename}`,
  uploadStreamToStorage: async () => ({ key: "test-key", storageType: "local" }),
  saveStreamedExportArtifact: async () => {},
  tenantUserHasPermission: async () => true,
  getWorkspaceBranding: async () => null,
  registerCsvExportRoutes: () => {},
  insertPlatformActivityLog: async () => {},
  getPreparedContactById: () => ({ execute: async () => ({ rows: [] }) }),
  getObject: async () => null,
  saveObject: async () => {},
  deleteObject: async () => {},
});

import { vi } from "vitest";
import { configureTasksPorts } from "../deps.js";

const noop = vi.fn(async () => ({})) as unknown as (...args: any[]) => Promise<any>;
configureTasksPorts({
  notificationsUseCases: {},
  messagingUseCases: {},
  usersUseCases: {},
  dispatchMessagingCampaignDirect: noop,
  getTenantUsersSettings: vi.fn(async () => ({})) as any,
  getTenantRoleCatalog: vi.fn(async () => []) as any,
  tenantUserHasPermission: vi.fn(() => true) as any,
  findFacultyByIds: vi.fn(async () => []) as any,
  lockFacultyHierarchy: noop,
  loadContactsSummaryByIdsForTenant: vi.fn(async () => []) as any,
  enqueueCsvExportJob: noop,
  normalizeExportQuery: vi.fn((q: unknown) => q) as any,
  enqueueBackgroundJob: noop,
  getUserBackgroundJob: vi.fn(async () => null) as any,
  getUserBackgroundJobPayload: vi.fn(async () => null) as any,
  retryFailedBackgroundJob: noop,
  hasBackgroundJobRunner: vi.fn(() => true) as any,
  isBackgroundJobLimitError: vi.fn(() => false) as any,
  isQueueUnavailableError: vi.fn(() => false) as any,
  registerModuleCsvExportJobRunner: vi.fn() as any,
});

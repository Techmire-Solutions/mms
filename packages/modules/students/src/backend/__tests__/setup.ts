import { vi } from "vitest";
import { configureStudentPorts } from "../deps.js";

// Deterministic defaults for the app-bound ports; tests that assert behaviour
// override them with partial `vi.mock("../deps.js", importOriginal)` factories.
const noop = vi.fn(async () => ({}));
configureStudentPorts({
  upsertContact: noop,
  findContactsMatchingUniqueValues: vi.fn(async () => []),
  reconcileContactSystemTags: noop,
  loadContactsByIdsForTenant: vi.fn(async () => []),
  loadContactsSummaryByIdsForTenant: vi.fn(async () => []),
  withdrawEnrollmentsForStudentStatus: noop,
  bulkEnrollStudentsIntoClass: noop,
  getModuleAccessDenial: vi.fn(async () => null),
  enqueueCsvExportJob: noop,
  normalizeExportQuery: vi.fn((query: unknown) => query),
  enqueueBackgroundJob: noop,
  getUserBackgroundJob: vi.fn(async () => null),
  getUserBackgroundJobPayload: vi.fn(async () => null),
  retryFailedBackgroundJob: noop,
  hasBackgroundJobRunner: vi.fn(() => true),
  isBackgroundJobLimitError: vi.fn(() => false),
  isQueueUnavailableError: vi.fn(() => false),
  registerModuleCsvExportJobRunner: vi.fn(),
});

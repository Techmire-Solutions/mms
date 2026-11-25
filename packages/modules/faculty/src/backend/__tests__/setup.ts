import { vi } from "vitest";
import { configureFacultyPorts } from "../deps.js";
import { configureCsvRouteDeps } from "@mms/be-core/http/routes";

// Deterministic defaults so unit tests that do not care about the app-bound
// surfaces never hit an unconfigured-port error. Tests that assert behaviour
// override these with their own `vi.mock("../deps.js", ...)`.
configureFacultyPorts({
  reconcileFacultyContactsByFacultyIds: vi.fn(async () => undefined),
  reconcileContactSystemTags: vi.fn(async () => undefined),
  reconcileDesignationContacts: vi.fn(async () => undefined),
  loadContactsSummaryByIdsForTenant: vi.fn(async () => []),
  findTenantUserRowByContactId: vi.fn(async () => null),
  upsertTenantUserRow: vi.fn(async () => undefined),
  listAllTenantUsersByWorkspace: vi.fn(async () => []),
  getTenantUsersSettings: vi.fn(async () => ({})),
  resolveCurrentTenantRole: vi.fn(async () => "staff"),
  tenantUserHasPermission: vi.fn(() => true),
  getUserModulePreferencesByWorkspace: vi.fn(async () => null),
  upsertUserModulePreferences: vi.fn(async () => undefined),
  invalidateTenantRbac: vi.fn(async () => undefined),
  registerModuleCsvExportJobRunner: vi.fn(),
});

configureCsvRouteDeps({
  registerCsvExportRoutes: vi.fn(),
  registerCsvImportRoutes: vi.fn(),
});

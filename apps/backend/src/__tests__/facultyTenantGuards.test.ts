/**
 * Missing-tenant handling.
 *
 * Handlers that build their tenant scope from the request must fail closed with
 * 403. `String(undefined)` used to reach `withTenant`, scoping the transaction to
 * the literal workspace "undefined" instead of refusing the request.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withTenant: vi.fn(),
  loadFacultyPage: vi.fn(),
  bulkUpdateFacultyStatus: vi.fn(),
  auditFaculty: vi.fn(),
  sanitizeFacultyListForViewer: vi.fn(),
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (...args: unknown[]) => mocks.withTenant(...args),
}));

vi.mock("../faculty/use-cases/facultyUseCases.js", () => ({
  facultyUseCases: {
    loadFacultyPage: (...args: unknown[]) => mocks.loadFacultyPage(...args),
    bulkUpdateFacultyStatus: (...args: unknown[]) => mocks.bulkUpdateFacultyStatus(...args),
    sanitizeFacultyListForViewer: (...args: unknown[]) =>
      mocks.sanitizeFacultyListForViewer(...args),
  },
}));

vi.mock("../routes/tenant/faculty/facultyRouteHelpers.js", () => ({
  auditFaculty: (...args: unknown[]) => mocks.auditFaculty(...args),
  sanitizeFacultyForUser: vi.fn(),
  sanitizeOneFacultyForUser: vi.fn(),
  handleDuplicateCheck: vi.fn(),
  handleNextEmployeeId: vi.fn(),
  handleMigrateEmployeeIds: vi.fn(),
}));

import { handleListFaculty } from "../routes/tenant/faculty/facultyCrudRoutes.js";
import { handleBulkStatus } from "../routes/tenant/faculty/facultyBulkRouteHandlers.js";

const ADMIN = { id: "u-admin", role: "admin", email: "admin@test.com" };

describe("faculty handlers without a tenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handleListFaculty answers 403 instead of scoping a transaction to "undefined"', async () => {
    const result = await handleListFaculty({
      query: {},
      request: { user: ADMIN } as never,
    });

    expect(result.status).toBe(403);
    expect(mocks.withTenant).not.toHaveBeenCalled();
    expect(mocks.loadFacultyPage).not.toHaveBeenCalled();
  });

  it('handleBulkStatus answers 403 instead of scoping a transaction to "undefined"', async () => {
    const result = await handleBulkStatus({
      body: { ids: ["f1"], status: "active" },
      request: { user: ADMIN, log: { error: vi.fn() } } as never,
    } as never);

    expect(result.status).toBe(403);
    expect(mocks.withTenant).not.toHaveBeenCalled();
    expect(mocks.bulkUpdateFacultyStatus).not.toHaveBeenCalled();
  });
});

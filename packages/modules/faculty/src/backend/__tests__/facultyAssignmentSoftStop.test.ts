import { beforeEach, describe, expect, it, vi } from "vitest";

const findFacultyAssignmentById = vi.fn();
const validateFacultyAssignment = vi.fn();
const lockFacultyHierarchy = vi.fn();
const recordModernAuditEvent = vi.fn();
const withTenant = vi.fn();

vi.mock("../repository/db/facultyAssignmentRepository.js", () => ({
  findFacultyAssignmentById: (...args: unknown[]) => findFacultyAssignmentById(...args),
}));

vi.mock("../repository/db/facultyAssignmentValidation.js", () => ({
  validateFacultyAssignment: (...args: unknown[]) => validateFacultyAssignment(...args),
  lockFacultyHierarchy: (...args: unknown[]) => lockFacultyHierarchy(...args),
}));

vi.mock("@mms/be-core/audit", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  recordModernAuditEvent: (...args: unknown[]) => recordModernAuditEvent(...args),
}));

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenant: (...args: unknown[]) => withTenant(...args),
}));

// The delete guard resolves "today" from the workspace row; stub it so this spec
// never loads the workspace repository cache.
vi.mock("@mms/be-core/datetime", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  workspaceTodayIso: vi.fn().mockResolvedValue("2026-11-04"),
}));

vi.mock("@mms/db/schema", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  facultyAssignments: {
    workspaceSubdomain: "workspace_subdomain",
    id: "id",
    facultyId: "faculty_id",
    designationId: "designation_id",
    departmentId: "department_id",
    isPrimary: "is_primary",
    deletedAt: "deleted_at",
    startDate: "start_date",
    endDate: "end_date",
  },
  faculty: {
    workspaceSubdomain: "workspace_subdomain",
    id: "id",
    deletedAt: "deleted_at",
  },
}));

import { saveFacultyAssignment } from "../repository/db/facultyAssignmentWriteRepository.js";

describe("saveFacultyAssignment writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withTenant.mockImplementation(async (_tenant: string, fn: (tx: unknown) => Promise<void>) => {
      // The save path pre-reads the row (CREATE vs UPDATE audit) before upserting.
      const selectChain = {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      };
      const tx = {
        select: vi.fn(() => selectChain),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        })),
      };
      await fn(tx);
    });
    validateFacultyAssignment.mockResolvedValue(undefined);
    lockFacultyHierarchy.mockResolvedValue(undefined);
    recordModernAuditEvent.mockResolvedValue(undefined);
  });

  it("validates and upserts an appointment", async () => {
    findFacultyAssignmentById.mockResolvedValue(null);
    await saveFacultyAssignment("demo", {
      id: "a1",
      facultyId: "f1",
      departmentId: "d1",
      designationId: "des1",
      isPrimary: true,
      startDate: "2026-01-01",
      updatedBy: "u1",
    } as never);

    expect(validateFacultyAssignment).toHaveBeenCalled();
    expect(recordModernAuditEvent).toHaveBeenCalled();
  });
});

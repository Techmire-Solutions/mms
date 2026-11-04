import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFaculty: vi.fn(),
  updateFacultyById: vi.fn(),
  findIdsByEmployeeIds: vi.fn(),
  reconcile: vi.fn(),
  broadcast: vi.fn(),
  listDepartments: vi.fn(),
  listDesignations: vi.fn(),
  tenantUserHasPermission: vi.fn(),
}));

vi.mock("../services/facultyService.js", () => ({
  createFaculty: mocks.createFaculty,
  updateFacultyById: mocks.updateFacultyById,
  findFacultyIdsByEmployeeIds: mocks.findIdsByEmployeeIds,
}));

vi.mock("../db/repositories/facultyDepartmentRepository.js", () => ({
  listFacultyDepartments: mocks.listDepartments,
}));

vi.mock("../db/repositories/facultyDesignationRepository.js", () => ({
  listFacultyDesignations: mocks.listDesignations,
}));

vi.mock("../contacts/systemTags/contactSystemTagUseCases.js", () => ({
  reconcileContactSystemTags: mocks.reconcile,
}));

vi.mock("../lib/tenantRoleCatalog.js", () => ({
  tenantUserHasPermission: mocks.tenantUserHasPermission,
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: mocks.broadcast,
}));

vi.mock("../lib/logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { runFacultyMembersImportJob } from "../faculty/use-cases/facultyImportJobUseCases.js";
import type { FacultyImportJobPayload } from "@mms/shared";

const payload: FacultyImportJobPayload = {
  rows: [
    { employeeId: "EMP-1", contactId: "c-1" },
    { employeeId: "EMP-2", contactId: "c-2" },
    { employeeId: "EMP-3", contactId: "c-3" },
  ],
} as unknown as FacultyImportJobPayload;

const context = {
  tenant: "demo",
  userId: "usr-admin",
  updateProgress: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listDepartments.mockResolvedValue([]);
  mocks.listDesignations.mockResolvedValue([]);
  mocks.reconcile.mockResolvedValue(undefined);
  mocks.broadcast.mockResolvedValue(undefined);
  mocks.tenantUserHasPermission.mockResolvedValue(true);
  mocks.findIdsByEmployeeIds.mockResolvedValue({ "emp-2": "fac-existing" });
  mocks.updateFacultyById.mockImplementation(
    async (_id: string, _patch: unknown, options?: { batch?: { contactIds: Set<string> } }) => {
      options?.batch?.contactIds.add("c-2");
      return { id: "fac-existing", contactId: "c-2" };
    },
  );
  mocks.createFaculty.mockImplementation(
    async (record: { contactId: string }, options?: { batch?: { contactIds: Set<string> } }) => {
      options?.batch?.contactIds.add(record.contactId);
      return {
        record: { id: `fac-${record.contactId}`, contactId: record.contactId },
        restored: false,
      };
    },
  );
});

describe("runFacultyMembersImportJob (batch writer)", () => {
  it("reconciles contact tags once and broadcasts once for a whole batch", async () => {
    const result = await runFacultyMembersImportJob(payload, context);

    expect(result).toMatchObject({ imported: 3, failed: 0, total: 3, failures: [] });
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    const reconciled = mocks.reconcile.mock.calls[0]?.[1] as string[];
    expect([...reconciled].sort()).toEqual(["c-1", "c-2", "c-3"]);
    expect(mocks.broadcast).toHaveBeenCalledTimes(1);
    expect(mocks.broadcast).toHaveBeenCalledWith("faculty");
  });

  it("looks up existing faculty in one batched employee-id query", async () => {
    await runFacultyMembersImportJob(payload, context);

    expect(mocks.findIdsByEmployeeIds).toHaveBeenCalledTimes(1);
    expect(mocks.findIdsByEmployeeIds).toHaveBeenCalledWith(["EMP-1", "EMP-2", "EMP-3"]);
  });

  it("defers per-row side effects through the batch collector", async () => {
    await runFacultyMembersImportJob(payload, context);

    const options = mocks.createFaculty.mock.calls[0]?.[1] as {
      batch?: { contactIds: Set<string> };
    };
    expect(options?.batch?.contactIds).toBeInstanceOf(Set);
    expect(mocks.updateFacultyById).toHaveBeenCalledWith(
      "fac-existing",
      expect.any(Object),
      expect.objectContaining({ batch: expect.any(Object) }),
    );
  });

  it("records row failures without aborting the batch", async () => {
    mocks.createFaculty.mockRejectedValueOnce(new Error("contactId required to create faculty"));

    const result = await runFacultyMembersImportJob(payload, context);

    expect(result).toMatchObject({ imported: 2, failed: 1, total: 3 });
    expect(result.failures[0]).toContain("contactId required");
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
  });
});

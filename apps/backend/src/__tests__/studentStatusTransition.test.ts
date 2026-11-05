import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Student } from "@mms/shared";
import type { StudentsRepository } from "../students/repository/studentsRepository.js";

const state = vi.hoisted(() => ({ depth: 0, withdrawDepth: -1 }));

const mockGetRequestTenant = vi.fn(() => "demo");
const mockBroadcastCollection = vi.fn();
const mockWithdraw = vi.fn();
const mockBulkUpdateStatus = vi.fn();
const mockAudit = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
  requireTenant: () => mockGetRequestTenant(),
}));

vi.mock("../db/database.js", () => ({
  runInTransaction: async (cb: () => unknown) => {
    state.depth += 1;
    try {
      return await cb();
    } finally {
      state.depth -= 1;
    }
  },
  runInGlobalTransaction: async (cb: () => unknown) => cb(),
  activeDb: () => ({}),
}));

vi.mock("../enrollments/use-cases/enrollmentEndUseCases.js", () => ({
  withdrawEnrollmentsForStudentStatus: (...args: unknown[]) => {
    state.withdrawDepth = state.depth;
    return mockWithdraw(...args);
  },
}));

vi.mock("../db/repositories/studentEnrollmentCascade.js", () => ({
  cascadeSoftDeleteEnrollmentsForStudents: vi.fn().mockResolvedValue(undefined),
  restoreCascadedEnrollmentsForStudents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcastCollection(...args),
}));

vi.mock("../lib/cache/index.js", () => ({
  invalidateMultiTierCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../contacts/systemTags/contactSystemTagUseCases.js", () => ({
  reconcileContactSystemTags: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: (...args: unknown[]) => mockAudit(...args),
  mapActionStringToAuditType: (action: string) =>
    action.toLowerCase().includes("delete") ? "DELETE" : "UPDATE",
  sanitizeAuditState: (value: unknown) => value,
}));

vi.mock("../students/use-cases/studentPreferencesService.js", () => ({
  loadStudentModulePreferences: vi.fn().mockResolvedValue({}),
}));

import { bulkUpdateStudentStatus } from "../students/use-cases/studentOperationUseCases.js";
import { updateStudentById } from "../students/use-cases/studentWriteUseCases.js";

const admin = { id: "u-admin", role: "admin", name: "Admin User" } as never;

function student(id: string, overrides: Partial<Student> = {}): Student {
  return {
    id,
    contactId: `c-${id}`,
    status: "active",
    registeredDate: "2026-01-01",
    ...overrides,
  };
}

function fakeRepo(rows: Student[]) {
  const store = new Map(rows.map((row) => [String(row.id), row]));
  const repo = {
    findById: vi.fn(async (_tenant: string, id: string) => store.get(id) ?? null),
    findByIds: vi.fn(async (_tenant: string, ids: string[]) =>
      ids.map((id) => store.get(id)).filter((row): row is Student => Boolean(row)),
    ),
    save: vi.fn(async (_tenant: string, row: Student) => {
      store.set(String(row.id), row);
    }),
    bulkUpdateStatusSql: (...args: unknown[]) => mockBulkUpdateStatus(...args),
    bulkSave: vi.fn(async () => undefined),
    findRegistrationConflict: vi.fn(async () => null),
    findActiveStudentIdOwners: vi.fn(async () => new Map<string, string>()),
    findSoftDeletedByContactId: vi.fn(async () => null),
  } as unknown as StudentsRepository;
  return { store, repo };
}

describe("student status transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.depth = 0;
    state.withdrawDepth = -1;
    mockGetRequestTenant.mockReturnValue("demo");
    mockWithdraw.mockResolvedValue({ ended: 1, billing: { cancelled: [], review: [] } });
    mockBulkUpdateStatus.mockResolvedValue(2);
    mockAudit.mockResolvedValue({ id: 1 });
  });

  it("withdraws the enrollments of every student a bulk status change ends", async () => {
    const { repo } = fakeRepo([student("s-1"), student("s-2")]);

    const result = await bulkUpdateStudentStatus(["s-1", "s-2"], "graduated", repo, admin);

    expect(result).toEqual({ succeeded: 2, failed: 0 });
    expect(mockWithdraw).toHaveBeenCalledTimes(2);
    expect(mockWithdraw).toHaveBeenNthCalledWith(1, "demo", "s-1", "graduated", {
      userId: "u-admin",
      label: "Admin User",
    });
    // Inside the status transaction, so a withdrawal failure rolls the status back.
    expect(state.withdrawDepth).toBe(1);
  });

  it("records one subject-scoped audit row per changed student and stamps updated_by", async () => {
    const { repo } = fakeRepo([student("s-1"), student("s-2")]);

    await bulkUpdateStudentStatus(["s-1", "s-2"], "graduated", repo, admin);

    expect(mockBulkUpdateStatus).toHaveBeenCalledWith(
      "demo",
      ["s-1", "s-2"],
      "graduated",
      "u-admin",
    );
    expect(mockAudit).toHaveBeenCalledTimes(2);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "students",
        recordId: "s-1",
        subjectId: "s-1",
        realUserId: "u-admin",
        oldState: { status: "active" },
        newState: { status: "graduated" },
      }),
    );
  });

  it("does not withdraw when the next status keeps the enrollment live", async () => {
    const { repo } = fakeRepo([student("s-1")]);
    mockBulkUpdateStatus.mockResolvedValue(1);

    await bulkUpdateStudentStatus(["s-1"], "suspended", repo, admin);

    expect(mockWithdraw).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledTimes(1);
  });

  it("dedupes repeated ids before counting or withdrawing", async () => {
    const { repo } = fakeRepo([student("s-1")]);
    mockBulkUpdateStatus.mockResolvedValue(1);

    const result = await bulkUpdateStudentStatus(["s-1", " s-1 "], "graduated", repo, admin);

    expect(result).toEqual({ succeeded: 1, failed: 0 });
    expect(mockBulkUpdateStatus).toHaveBeenCalledWith("demo", ["s-1"], "graduated", "u-admin");
    expect(mockWithdraw).toHaveBeenCalledTimes(1);
  });

  it("propagates a withdrawal failure without committing post-commit side effects", async () => {
    const { repo } = fakeRepo([student("s-1")]);
    mockWithdraw.mockRejectedValue(new Error("finance settlement failed"));

    await expect(bulkUpdateStudentStatus(["s-1"], "graduated", repo, admin)).rejects.toThrow(
      "finance settlement failed",
    );
    expect(mockBroadcastCollection).not.toHaveBeenCalled();
  });

  it("withdraws inside the transaction on a single student update", async () => {
    const { repo, store } = fakeRepo([student("s-1")]);

    const updated = await updateStudentById(
      "s-1",
      { status: "graduated" } as never,
      { user: admin } as never,
      repo,
    );

    expect(updated?.status).toBe("graduated");
    expect(store.get("s-1")?.status).toBe("graduated");
    expect(mockWithdraw).toHaveBeenCalledWith("demo", "s-1", "graduated", {
      userId: "u-admin",
      label: "Admin User",
    });
    expect(state.withdrawDepth).toBe(1);
  });
});

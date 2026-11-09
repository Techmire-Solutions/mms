import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceRecord, User } from "@mms/shared";
import { createAttendanceMutationUseCases } from "../attendance/use-cases/attendanceMutationUseCases.js";
import { createAttendanceMarkUseCases } from "../attendance/use-cases/attendanceMarkUseCases.js";
import { createAttendanceTrashUseCases } from "../attendance/use-cases/attendanceTrashUseCases.js";
import {
  notEnrolled,
  requireTenant,
  type AttendanceMutationDeps,
} from "../attendance/use-cases/attendanceUseCaseSupport.js";
import { runWithTenant } from "../lib/tenantContext.js";

/**
 * Write orchestration for the attendance domain: the ordering guarantee (validate → guard → policy →
 * persist → audit), the "a rejected policy writes nothing" guarantee, and the per-change audit rule
 * for a whole roster.
 */

const ACTOR = { id: "u-teacher", role: "teacher" } as unknown as User;

const policyRejection = new Error("policy rejected");
const mocks = vi.hoisted(() => ({
  assertAttendanceWriteAllowed: vi.fn(),
  assertAttendanceDayEditable: vi.fn(),
  auditAttendanceMutation: vi.fn(),
  stampAttendanceSections: vi.fn(),
  assertInstructionalDays: vi.fn(),
  assertTeacherClassScope: vi.fn(),
}));

vi.mock("../attendance/use-cases/attendancePolicyGuard.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../attendance/use-cases/attendancePolicyGuard.js")>();
  return {
    ...actual,
    assertAttendanceWriteAllowed: mocks.assertAttendanceWriteAllowed,
    assertAttendanceDayEditable: mocks.assertAttendanceDayEditable,
  };
});
vi.mock("../attendance/use-cases/attendanceAudit.js", () => ({
  auditAttendanceMutation: mocks.auditAttendanceMutation,
}));
vi.mock("../attendance/use-cases/attendanceSectionStamp.js", () => ({
  stampAttendanceSections: mocks.stampAttendanceSections,
}));
vi.mock("../attendance/use-cases/instructionalDayGuard.js", () => ({
  assertInstructionalDays: mocks.assertInstructionalDays,
  findNonInstructionalRows: vi.fn().mockResolvedValue([]),
}));
vi.mock("../sessions/use-cases/teacherSectionScope.js", () => ({
  assertTeacherClassScope: mocks.assertTeacherClassScope,
  assertTeacherSectionScope: mocks.assertTeacherClassScope,
  assertTeacherAnyClassScope: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn(),
  broadcastTenantUpdate: vi.fn(),
}));

function record(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: "att-1",
    classId: "class-a",
    studentId: "student-1",
    studentName: "Student",
    rollNo: "001",
    date: "2026-07-27",
    status: "present",
    timeIn: "07:00",
    timeOut: "08:30",
    notes: "",
    version: 1,
    ...overrides,
  } as AttendanceRecord;
}

function createDeps(overrides: Partial<AttendanceMutationDeps> = {}): AttendanceMutationDeps {
  const repo = {
    findAttendanceRecordById: vi.fn().mockResolvedValue(null),
    findAttendanceRecordsByIds: vi.fn().mockResolvedValue([]),
    findAttendanceRecordsForStudentsOnDates: vi.fn().mockResolvedValue([]),
    saveAttendanceRecord: vi.fn().mockResolvedValue(undefined),
    saveAttendanceRecordById: vi.fn().mockResolvedValue(null),
    bulkSaveAttendanceRecords: vi.fn().mockResolvedValue([]),
  };
  const crud = {
    create: vi.fn(async (input: AttendanceRecord) => input),
    deleteById: vi.fn().mockResolvedValue(true),
    restoreById: vi.fn().mockResolvedValue(true),
    bulkDeleteByIds: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
    bulkRestoreByIds: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
  };
  return {
    repo: repo as unknown as AttendanceMutationDeps["repo"],
    crud: crud as unknown as AttendanceMutationDeps["crud"],
    policyStore: undefined,
    validateActiveForeignKeys: vi.fn().mockResolvedValue(undefined),
    validateBatchActiveForeignKeys: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as AttendanceMutationDeps;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Re-arm the defaults: a rejection installed by one case must not leak into the next.
  // The gate reports whether it had to override a lock/cut-off (undefined would mean "no summary").
  mocks.assertAttendanceWriteAllowed
    .mockReset()
    .mockResolvedValue({ overridden: false, codes: [] });
  mocks.assertAttendanceDayEditable.mockReset().mockResolvedValue({ overridden: false, codes: [] });
  mocks.assertTeacherClassScope.mockReset().mockResolvedValue(undefined);
  mocks.assertInstructionalDays.mockReset().mockResolvedValue(undefined);
  mocks.auditAttendanceMutation.mockReset().mockResolvedValue(undefined);
  mocks.stampAttendanceSections
    .mockReset()
    .mockImplementation(async (_tenant: string, rows: unknown[]) => ({
      records: rows,
      rejected: [],
    }));
});

describe("attendanceUseCaseSupport", () => {
  it("requireTenant throws without an ambient tenant", () => {
    expect(() => requireTenant()).toThrow("Tenant context required");
  });

  it("notEnrolled is a 422 domain error naming the student and day", () => {
    const error = notEnrolled({ studentId: "st-1", classId: "c-1", date: "2026-07-27" });
    expect(error.statusCode).toBe(422);
    expect(error.type).toBe("attendance_not_enrolled");
    expect(error.message).toContain("st-1");
  });
});

describe("createAttendanceMarkUseCases", () => {
  it("runs foreign-key validation before the write and audits a create", async () => {
    const deps = createDeps();
    const useCases = createAttendanceMarkUseCases(deps);
    const callOrder: string[] = [];
    vi.mocked(deps.validateActiveForeignKeys).mockImplementation(async () => {
      callOrder.push("fk");
    });
    mocks.assertTeacherClassScope.mockImplementation(async () => {
      callOrder.push("scope");
    });
    mocks.assertAttendanceWriteAllowed.mockImplementation(async () => {
      callOrder.push("policy");
      return { overridden: false, codes: [] };
    });
    vi.mocked(deps.crud.create).mockImplementation(async (input: AttendanceRecord) => {
      callOrder.push("write");
      return input;
    });

    const created = await runWithTenant("demo", () =>
      useCases.createAttendanceRecord(record(), ACTOR),
    );

    expect(callOrder).toEqual(["fk", "scope", "policy", "write"]);
    expect(created.id).toBe("att-1");
    expect(mocks.auditAttendanceMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "CREATE" }),
    );
  });

  it("writes nothing when the policy rejects the mark", async () => {
    const deps = createDeps();
    const useCases = createAttendanceMarkUseCases(deps);
    mocks.assertAttendanceWriteAllowed.mockRejectedValue(policyRejection);

    await expect(
      runWithTenant("demo", () => useCases.createAttendanceRecord(record(), ACTOR)),
    ).rejects.toBe(policyRejection);

    expect(deps.crud.create).not.toHaveBeenCalled();
    expect(mocks.auditAttendanceMutation).not.toHaveBeenCalled();
  });

  it("rejects a batch row the section stamp refuses", async () => {
    const deps = createDeps();
    const useCases = createAttendanceMarkUseCases(deps);
    mocks.stampAttendanceSections.mockResolvedValue({
      records: [],
      rejected: [{ studentId: "student-1", classId: "class-a", date: "2026-07-27" }],
    });

    await expect(
      runWithTenant("demo", () => useCases.upsertAttendanceRecords([record()], ACTOR)),
    ).rejects.toMatchObject({ statusCode: 422, type: "attendance_not_enrolled" });
    expect(deps.repo.bulkSaveAttendanceRecords).not.toHaveBeenCalled();
  });

  it("audits only the rows whose status actually changed in a roster save", async () => {
    const deps = createDeps();
    const useCases = createAttendanceMarkUseCases(deps);
    const untouched = record({ id: "att-same", studentId: "student-same", status: "present" });
    const changed = record({ id: "att-changed", studentId: "student-2", status: "absent" });
    vi.mocked(deps.repo.findAttendanceRecordsForStudentsOnDates).mockResolvedValue([
      untouched,
      { ...changed, status: "present" },
    ]);
    vi.mocked(deps.repo.bulkSaveAttendanceRecords).mockImplementation(
      async (_tenant, rows) => rows,
    );

    await runWithTenant("demo", () =>
      useCases.upsertAttendanceRecords([untouched, changed], ACTOR),
    );

    expect(mocks.auditAttendanceMutation).toHaveBeenCalledTimes(1);
    expect(mocks.auditAttendanceMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "UPDATE",
        record: expect.objectContaining({ id: "att-changed" }),
      }),
    );
  });

  it("audits a time-only correction even when the status is unchanged", async () => {
    const deps = createDeps();
    const useCases = createAttendanceMarkUseCases(deps);
    // Same status, different time-in: previously this produced no audit row at all.
    const before = record({
      id: "att-time",
      studentId: "student-time",
      status: "late",
      timeIn: "08:00",
      timeOut: "08:30",
    });
    const corrected = { ...before, timeIn: "07:10" };
    vi.mocked(deps.repo.findAttendanceRecordsForStudentsOnDates).mockResolvedValue([before]);
    vi.mocked(deps.repo.bulkSaveAttendanceRecords).mockImplementation(
      async (_tenant, rows) => rows,
    );

    await runWithTenant("demo", () => useCases.upsertAttendanceRecords([corrected], ACTOR));

    expect(mocks.auditAttendanceMutation).toHaveBeenCalledTimes(1);
    expect(mocks.auditAttendanceMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "UPDATE",
        before: expect.objectContaining({ timeIn: "08:00" }),
        record: expect.objectContaining({ timeIn: "07:10", status: "late" }),
      }),
    );
  });

  it("tags an approved override in the audit row with its justification", async () => {
    const deps = createDeps();
    const useCases = createAttendanceMarkUseCases(deps);
    mocks.assertAttendanceWriteAllowed.mockResolvedValueOnce({
      overridden: true,
      codes: ["attendance_cutoff_passed"],
    });
    vi.mocked(deps.repo.findAttendanceRecordsForStudentsOnDates).mockResolvedValue([]);
    vi.mocked(deps.repo.bulkSaveAttendanceRecords).mockImplementation(
      async (_tenant, rows) => rows,
    );

    await runWithTenant("demo", () =>
      useCases.upsertAttendanceRecords([record()], ACTOR, "Guardian produced a note"),
    );

    expect(mocks.auditAttendanceMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tag: "attendance.override",
        reason: "Guardian produced a note",
      }),
    );
  });

  it("updates through the by-id primitive so a mark can be moved", async () => {
    const deps = createDeps();
    const useCases = createAttendanceMarkUseCases(deps);
    const existing = record({ date: "2026-07-27" });
    vi.mocked(deps.repo.findAttendanceRecordById).mockResolvedValue(existing);
    vi.mocked(deps.repo.saveAttendanceRecordById).mockResolvedValue({
      ...existing,
      date: "2026-07-28",
      version: 2,
    });

    const moved = await runWithTenant("demo", () =>
      useCases.updateAttendanceRecordById("att-1", { date: "2026-07-28" }, ACTOR),
    );

    expect(deps.repo.saveAttendanceRecordById).toHaveBeenCalledTimes(1);
    expect(deps.repo.saveAttendanceRecord).not.toHaveBeenCalled();
    expect(moved).toMatchObject({ date: "2026-07-28", version: 2 });
    expect(mocks.auditAttendanceMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tag: "attendance.moved" }),
    );
  });
});

describe("createAttendanceTrashUseCases", () => {
  it("refuses to archive a locked day and writes nothing", async () => {
    const deps = createDeps();
    const useCases = createAttendanceTrashUseCases(deps);
    vi.mocked(deps.repo.findAttendanceRecordById).mockResolvedValue(record());
    mocks.assertAttendanceDayEditable.mockRejectedValue(policyRejection);

    await expect(
      runWithTenant("demo", () => useCases.deleteAttendanceRecordById("att-1", ACTOR, "typo")),
    ).rejects.toBe(policyRejection);

    expect(deps.crud.deleteById).not.toHaveBeenCalled();
    expect(mocks.auditAttendanceMutation).not.toHaveBeenCalled();
  });

  it("audits a successful archive with the reason", async () => {
    const deps = createDeps();
    const useCases = createAttendanceTrashUseCases(deps);
    vi.mocked(deps.repo.findAttendanceRecordById).mockResolvedValue(record());

    const deleted = await runWithTenant("demo", () =>
      useCases.deleteAttendanceRecordById("att-1", ACTOR, "wrong student"),
    );

    expect(deleted).toBe(true);
    expect(mocks.auditAttendanceMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "DELETE", reason: "wrong student" }),
    );
  });

  it("returns false for a row that is already archived", async () => {
    const deps = createDeps();
    const useCases = createAttendanceTrashUseCases(deps);
    vi.mocked(deps.repo.findAttendanceRecordById).mockResolvedValue(
      record({ deletedAt: "2026-07-01T00:00:00.000Z" }),
    );

    await expect(
      runWithTenant("demo", () => useCases.deleteAttendanceRecordById("att-1", ACTOR)),
    ).resolves.toBe(false);
    expect(deps.crud.deleteById).not.toHaveBeenCalled();
  });
});

describe("createAttendanceMutationUseCases", () => {
  it("exposes both the marking and the trash surface, and no replace-all", () => {
    const useCases = createAttendanceMutationUseCases(createDeps());
    for (const key of [
      "createAttendanceRecord",
      "updateAttendanceRecordById",
      "upsertAttendanceRecords",
      "deleteAttendanceRecordById",
      "restoreAttendanceRecordById",
      "bulkSoftDeleteAttendance",
      "bulkRestoreAttendance",
    ]) {
      expect(useCases).toHaveProperty(key);
    }
    // The workspace-wide hard-delete replace belongs to the restore mirror, not this API.
    expect(useCases).not.toHaveProperty("replaceAttendanceRecords");
  });
});

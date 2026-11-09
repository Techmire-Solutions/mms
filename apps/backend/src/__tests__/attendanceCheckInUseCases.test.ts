import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceRecord, User } from "@mms/shared";
import { runWithTenant } from "../lib/tenantContext.js";

/**
 * Device check-in ingestion: dedupe, excused conflicts, row-level errors, locked days.
 *
 * A replayed batch must write nothing and report `duplicate`; a device must never overwrite an
 * approved excuse; the roster lock still blocks a submitted day.
 */

const ADMIN = { id: "u-admin", role: "admin" } as unknown as User;

const mocks = vi.hoisted(() => ({
  findForStudentsOnDates: vi.fn(),
  bulkSave: vi.fn(),
  audit: vi.fn(),
  stamp: vi.fn(),
  scope: vi.fn(),
  policy: vi.fn(),
  prefs: vi.fn(),
  timezone: vi.fn(),
}));

vi.mock("../attendance/use-cases/attendanceSectionStamp.js", () => ({
  stampAttendanceSections: mocks.stamp,
}));
vi.mock("../sessions/use-cases/teacherSectionScope.js", () => ({
  assertTeacherSectionScope: mocks.scope,
  assertTeacherClassScope: vi.fn(),
  assertTeacherAnyClassScope: vi.fn(),
}));
vi.mock("../attendance/use-cases/attendancePolicyGuard.js", () => ({
  assertAttendanceWriteAllowed: mocks.policy,
  attendancePolicyKey: (row: { classId: string; studentId: string; date: string }) =>
    `${row.classId}|${row.studentId}|${row.date.slice(0, 10)}`,
}));
vi.mock("../attendance/use-cases/attendanceAudit.js", () => ({
  auditAttendanceMutation: mocks.audit,
}));
vi.mock("../attendance/repository/attendanceCalendarRepositoryAdapter.js", () => ({
  attendanceCalendarRepository: {
    findWorkspaceTimezone: mocks.timezone,
    getAttendanceModulePreferences: mocks.prefs,
    listApprovedLeavesFor: vi.fn().mockResolvedValue([]),
    listLockedAttendanceDayKeys: vi.fn().mockResolvedValue(new Set<string>()),
    lockAttendanceStudents: vi.fn().mockResolvedValue(undefined),
  },
}));

const { createAttendanceCheckInUseCases } =
  await import("../attendance/use-cases/attendanceCheckInUseCases.js");

function record(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: "att-1",
    classId: "cls-1",
    studentId: "std-1",
    studentName: "Amina",
    rollNo: "1",
    date: "2026-03-09",
    status: "present",
    timeIn: "08:00",
    timeOut: "",
    notes: "",
    ...overrides,
  } as AttendanceRecord;
}

function build() {
  return createAttendanceCheckInUseCases({
    repo: {
      findAttendanceRecordsForStudentsOnDates: mocks.findForStudentsOnDates,
      bulkSaveAttendanceRecords: mocks.bulkSave,
    } as never,
  });
}

/** The fixture day is 2026-03-09; keep the use case's clock inside the 7-day window. */
const NOW = new Date("2026-03-10T09:00:00.000Z");

const BODY = {
  deviceId: "reader-1",
  rows: [{ studentId: "std-1", classId: "cls-1", date: "2026-03-09", timeIn: "08:00" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.timezone.mockResolvedValue("UTC");
  mocks.prefs.mockResolvedValue({});
  mocks.stamp.mockImplementation(async (_tenant: string, records: AttendanceRecord[]) => ({
    records: records.map((row) => ({ ...row, sectionId: "sec-1" })),
    rejected: [],
  }));
  mocks.scope.mockResolvedValue(undefined);
  mocks.policy.mockResolvedValue({ overridden: false, codes: [] });
  mocks.findForStudentsOnDates.mockResolvedValue([]);
  mocks.bulkSave.mockImplementation(async (_tenant: string, rows: AttendanceRecord[]) => rows);
  mocks.audit.mockResolvedValue(undefined);
});

describe("ingestAttendanceCheckIns", () => {
  it("accepts a new check-in and audits the device provenance", async () => {
    const result = await runWithTenant("demo", () =>
      build().ingestCheckIns("demo", BODY as never, ADMIN, { now: NOW }),
    );

    expect(result.accepted).toBe(1);
    expect(result.duplicates).toBe(0);
    expect(mocks.bulkSave).toHaveBeenCalledTimes(1);
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "CREATE",
        tag: "attendance.device.check_in",
        extra: expect.objectContaining({ source: "device", deviceId: "reader-1" }),
      }),
    );
    // Device evidence waives the cut-off but not the lock.
    expect(mocks.policy).toHaveBeenCalledWith(expect.objectContaining({ source: "device" }));
  });

  it("reports a replayed batch as duplicate and writes nothing", async () => {
    mocks.findForStudentsOnDates.mockResolvedValue([record()]);

    const result = await runWithTenant("demo", () =>
      build().ingestCheckIns("demo", BODY as never, ADMIN, { now: NOW }),
    );

    expect(result).toMatchObject({ accepted: 0, duplicates: 1, rejected: [] });
    expect(mocks.bulkSave).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("refuses to overwrite an approved excuse", async () => {
    mocks.findForStudentsOnDates.mockResolvedValue([record({ status: "excused" })]);

    const result = await runWithTenant("demo", () =>
      build().ingestCheckIns("demo", BODY as never, ADMIN, { now: NOW }),
    );

    expect(result.accepted).toBe(0);
    expect(result.rejected[0]).toMatchObject({ code: "attendance_excused_conflict" });
    expect(mocks.bulkSave).not.toHaveBeenCalled();
  });

  it("upgrades an absent mark and audits the correction", async () => {
    mocks.findForStudentsOnDates.mockResolvedValue([record({ status: "absent", timeIn: "" })]);

    const result = await runWithTenant("demo", () =>
      build().ingestCheckIns("demo", BODY as never, ADMIN, { now: NOW }),
    );

    expect(result.accepted).toBe(1);
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "UPDATE",
        before: expect.objectContaining({ status: "absent" }),
        extra: expect.objectContaining({ previousStatus: "absent" }),
      }),
    );
  });

  it("rejects an invalid timestamp per row without failing the batch", async () => {
    const result = await runWithTenant("demo", () =>
      build().ingestCheckIns(
        "demo",
        {
          deviceId: "reader-1",
          rows: [
            { studentId: "std-1", classId: "cls-1", date: "2026-03-09", timeIn: "08:00" },
            { studentId: "std-2", classId: "cls-1", date: "2026-03-09", timeIn: "99:99" },
          ],
        } as never,
        ADMIN,
        { now: NOW },
      ),
    );

    expect(result.accepted).toBe(1);
    expect(result.rejected).toEqual([
      { row: 1, code: "invalid_timestamp", message: expect.stringContaining("Invalid") },
    ]);
  });

  it("reports a non-enrolled student as a row error", async () => {
    mocks.stamp.mockResolvedValue({
      records: [],
      rejected: [
        { studentId: "std-1", classId: "cls-1", date: "2026-03-09", reason: "not_enrolled" },
      ],
    });

    const result = await runWithTenant("demo", () =>
      build().ingestCheckIns("demo", BODY as never, ADMIN, { now: NOW }),
    );

    expect(result.accepted).toBe(0);
    expect(result.rejected[0]).toMatchObject({ code: "attendance_not_enrolled" });
  });
});

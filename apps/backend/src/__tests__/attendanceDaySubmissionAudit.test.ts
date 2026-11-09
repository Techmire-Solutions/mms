import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@mms/shared";
import { runWithTenant } from "../lib/tenantContext.js";

/**
 * Roster-day submission audit + scope and the suspension-leave audit.
 *
 * Reopening a submitted day is the sanctioned way to unlock attendance evidence; it used to leave no
 * audit row at all. Approved leave created by an enrollment suspension removes days from every rate
 * and was equally invisible on the attendance side.
 */

const TEACHER = { id: "u-teacher", role: "teacher" } as unknown as User;

const mocks = vi.hoisted(() => ({
  getDaySubmission: vi.fn(),
  upsertDaySubmission: vi.fn(),
  reopenDay: vi.fn(),
  insertApprovedLeaveIfFree: vi.fn(),
  audit: vi.fn(),
  broadcast: vi.fn(),
  assertClassScope: vi.fn(),
}));

vi.mock("../attendance/repository/attendanceCalendarRepositoryAdapter.js", () => ({
  attendanceCalendarRepository: {
    getAttendanceDaySubmission: mocks.getDaySubmission,
    upsertAttendanceDaySubmission: mocks.upsertDaySubmission,
    reopenAttendanceDay: mocks.reopenDay,
    insertApprovedLeaveIfFree: mocks.insertApprovedLeaveIfFree,
  },
}));
vi.mock("../services/auditTrailService.js", () => ({ recordModernAuditEvent: mocks.audit }));
vi.mock("../lib/livePush.js", () => ({ broadcastCollection: mocks.broadcast }));
vi.mock("../sessions/use-cases/teacherSectionScope.js", () => ({
  assertTeacherClassScope: mocks.assertClassScope,
  assertTeacherSectionScope: mocks.assertClassScope,
}));

const { submitAttendanceDay, reopenSubmittedAttendanceDay, recordApprovedLeave } =
  await import("../attendance/use-cases/attendanceLeaveUseCases.js");

const submission = {
  classId: "cls-1",
  date: "2026-03-02",
  submittedAt: new Date("2026-03-02T09:00:00Z"),
  submittedBy: "u-teacher",
  reopenedAt: null,
  reopenedBy: null,
  reopenReason: null,
  locked: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDaySubmission.mockResolvedValue(null);
  mocks.upsertDaySubmission.mockResolvedValue(submission);
  mocks.reopenDay.mockResolvedValue({ ...submission, locked: false });
  mocks.insertApprovedLeaveIfFree.mockResolvedValue({ ok: true, id: "leave-1" });
  mocks.audit.mockResolvedValue(undefined);
  mocks.assertClassScope.mockResolvedValue(undefined);
});

describe("submitAttendanceDay", () => {
  it("scope-checks the class and audits the lock inside the transaction", async () => {
    await runWithTenant("demo", () =>
      submitAttendanceDay(
        "demo",
        { classId: "cls-1", date: "2026-03-02", submittedBy: "u-teacher" },
        TEACHER,
      ),
    );

    expect(mocks.assertClassScope).toHaveBeenCalledWith(TEACHER, "demo", [
      { classId: "cls-1", date: "2026-03-02" },
    ]);
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tableName: "attendance_day_submissions",
        actionType: "CREATE",
        oldState: { locked: false },
        newState: expect.objectContaining({
          locked: true,
          tag: "attendance.day.submitted",
        }),
      }),
    );
  });

  it("does not audit (or re-lock) an already submitted day", async () => {
    mocks.getDaySubmission.mockResolvedValue(submission);
    const result = await runWithTenant("demo", () =>
      submitAttendanceDay("demo", {
        classId: "cls-1",
        date: "2026-03-02",
        submittedBy: "u-teacher",
      }),
    );
    expect(result.alreadySubmitted).toBe(true);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});

describe("reopenSubmittedAttendanceDay", () => {
  it("audits the unlock with the re-opener and reason", async () => {
    await runWithTenant("demo", () =>
      reopenSubmittedAttendanceDay("demo", {
        classId: "cls-1",
        date: "2026-03-02",
        reopenedBy: "u-admin",
        reason: "Correcting a mis-mark",
      }),
    );

    expect(mocks.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tableName: "attendance_day_submissions",
        actionType: "UPDATE",
        realUserId: "u-admin",
        oldState: { locked: true },
        newState: expect.objectContaining({
          locked: false,
          reason: "Correcting a mis-mark",
          tag: "attendance.day.reopened",
        }),
      }),
    );
  });

  it("does not audit a day that was never submitted", async () => {
    mocks.reopenDay.mockResolvedValue(null);
    await expect(
      runWithTenant("demo", () =>
        reopenSubmittedAttendanceDay("demo", {
          classId: "cls-1",
          date: "2026-03-02",
          reopenedBy: "u-admin",
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});

describe("recordApprovedLeave", () => {
  it("audits the approved leave created by an enrollment suspension", async () => {
    const id = await runWithTenant("demo", () =>
      recordApprovedLeave("demo", {
        studentId: "student-1",
        fromOn: "2026-03-02",
        toOn: "2026-03-04",
        reason: "Suspension",
        approvedBy: "u-admin",
      }),
    );

    expect(id).toBe("leave-1");
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tableName: "attendance_leaves",
        actionType: "CREATE",
        realUserId: "u-admin",
        newState: expect.objectContaining({
          source: "enrollment_suspension",
          tag: "attendance.leave.suspension",
        }),
      }),
    );
  });

  it("writes no audit row when the overlap check refuses the range", async () => {
    mocks.insertApprovedLeaveIfFree.mockResolvedValue({
      ok: false,
      conflict: { fromDate: "2026-03-01", toDate: "2026-03-05" },
    });
    await expect(
      runWithTenant("demo", () =>
        recordApprovedLeave("demo", {
          studentId: "student-1",
          fromOn: "2026-03-02",
          toOn: "2026-03-04",
          reason: "Suspension",
          approvedBy: "u-admin",
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@mms/shared";

/** Excuse audit + notification emission: every decision leaves a reconstructable trail. */

const ADMIN = { id: "u-admin", role: "admin" } as unknown as User;

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  notify: vi.fn(),
  excuseAbsencesInRange: vi.fn(),
}));

vi.mock("../services/auditTrailService.js", () => ({ recordModernAuditEvent: mocks.audit }));
vi.mock("../notifications/use-cases/notificationsUseCases.js", () => ({
  notificationsUseCases: { notify: mocks.notify },
}));
vi.mock("../attendance/repository/attendanceLeaveAdapter.js", () => ({
  attendanceLeaveRepository: { excuseAbsencesInRange: mocks.excuseAbsencesInRange },
}));

const { auditLeave, notifyLeaveDecision, syncExcusedMarks, EXCUSE_NOTE } =
  await import("../attendance/use-cases/attendanceExcuseAudit.js");

const leave = {
  id: "leave-1",
  studentId: "student-1",
  studentName: "Amina",
  fromDate: "2026-03-02",
  toDate: "2026-03-04",
  leaveType: "medical",
  status: "approved",
  reviewedBy: "u-admin",
  documentRef: null,
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.audit.mockResolvedValue(undefined);
  mocks.notify.mockResolvedValue(undefined);
  mocks.excuseAbsencesInRange.mockResolvedValue([]);
});

describe("auditLeave", () => {
  it("records the old and new status plus the review note", async () => {
    await auditLeave({} as never, "demo", ADMIN, leave, "pending", "approved", "Looks genuine");

    expect(mocks.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tableName: "attendance_leaves",
        recordId: "leave-1",
        oldState: { status: "pending" },
        newState: expect.objectContaining({ status: "approved", note: "Looks genuine" }),
      }),
    );
  });
});

describe("syncExcusedMarks", () => {
  it("audits every converted mark with its previous status", async () => {
    mocks.excuseAbsencesInRange.mockResolvedValue([
      {
        id: "att-1",
        studentId: "student-1",
        classId: "cls-1",
        date: "2026-03-02",
        previousStatus: "absent",
        previousNotes: "",
      },
      {
        id: "att-2",
        studentId: "student-1",
        classId: "cls-1",
        date: "2026-03-03",
        previousStatus: "absent",
        previousNotes: "",
      },
    ]);

    await syncExcusedMarks({} as never, "demo", leave, ADMIN);

    expect(mocks.excuseAbsencesInRange).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ studentId: "student-1", note: EXCUSE_NOTE }),
    );
    expect(mocks.audit).toHaveBeenCalledTimes(2);
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tableName: "attendance",
        actionType: "UPDATE",
        oldState: expect.objectContaining({ status: "absent" }),
        newState: expect.objectContaining({ status: "excused", tag: "attendance.leave_sync" }),
      }),
    );
  });

  it("does nothing when the leave carries no range", async () => {
    const noRange = { ...(leave as Record<string, unknown>), fromDate: null } as never;
    await syncExcusedMarks({} as never, "demo", noRange, ADMIN);
    expect(mocks.excuseAbsencesInRange).not.toHaveBeenCalled();
  });
});

describe("notifyLeaveDecision", () => {
  it("notifies attendance writers with the decision and range", async () => {
    await notifyLeaveDecision("demo", leave, "approved");
    expect(mocks.notify).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        kind: "attendance_leave_decided",
        audiencePermission: "attendance.write",
        entityId: "leave-1",
      }),
    );
  });
});

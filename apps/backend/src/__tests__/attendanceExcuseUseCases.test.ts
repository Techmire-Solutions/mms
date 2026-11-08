import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@mms/shared";
import { runWithTenant } from "../lib/tenantContext.js";

/**
 * Excuse lifecycle orchestration: submission validation, the guarded decision, and the retroactive
 * mark synchronisation an approval performs.
 */

const ADMIN = { id: "u-admin", role: "admin" } as unknown as User;

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  findById: vi.fn(),
  insertPending: vi.fn(),
  decide: vi.fn(),
  cancel: vi.fn(),
  excuseAbsences: vi.fn(),
  lockStudents: vi.fn(),
  audit: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("../attendance/repository/attendanceLeaveAdapter.js", () => ({
  attendanceLeaveRepository: {
    listAttendanceLeaves: mocks.list,
    findAttendanceLeaveById: mocks.findById,
    insertPendingLeave: mocks.insertPending,
    decideAttendanceLeave: mocks.decide,
    cancelAttendanceLeave: mocks.cancel,
    excuseAbsencesInRange: mocks.excuseAbsences,
    lockAttendanceStudents: mocks.lockStudents,
  },
}));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mocks.audit,
}));
vi.mock("../notifications/use-cases/notificationsUseCases.js", () => ({
  notificationsUseCases: { notify: mocks.notify },
}));
vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn(),
  broadcastTenantUpdate: vi.fn(),
}));

const { attendanceExcuseUseCases } =
  await import("../attendance/use-cases/attendanceExcuseUseCases.js");

function leave(overrides: Record<string, unknown> = {}) {
  return {
    id: "leave-1",
    studentId: "student-1",
    studentName: "Amina Ali",
    fromDate: "2026-03-02",
    toDate: "2026-03-04",
    reason: "Fever",
    status: "pending",
    leaveType: "medical",
    submittedBy: "u-parent",
    submittedAt: new Date("2026-03-01T10:00:00Z"),
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    cancelledBy: null,
    cancelledAt: null,
    documentRef: null,
    approvedBy: null,
    approvedAt: null,
    notes: null,
    createdAt: new Date("2026-03-01T10:00:00Z"),
    updatedAt: new Date("2026-03-01T10:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.lockStudents.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue([]);
  mocks.excuseAbsences.mockResolvedValue([]);
  mocks.audit.mockResolvedValue(undefined);
  mocks.notify.mockResolvedValue(undefined);
});

describe("submitExcuse", () => {
  it("rejects an inverted date range before touching storage", async () => {
    await expect(
      runWithTenant("demo", () =>
        attendanceExcuseUseCases.submitExcuse(
          {
            studentId: "student-1",
            fromDate: "2026-03-05",
            toDate: "2026-03-02",
            reason: "Fever",
            leaveType: "medical",
            notes: "",
          } as never,
          ADMIN,
        ),
      ),
    ).rejects.toThrow();
    expect(mocks.insertPending).not.toHaveBeenCalled();
  });

  it("rejects a request overlapping an approved leave", async () => {
    mocks.list.mockResolvedValue([leave({ status: "approved" })]);
    await expect(
      runWithTenant("demo", () =>
        attendanceExcuseUseCases.submitExcuse(
          {
            studentId: "student-1",
            fromDate: "2026-03-03",
            toDate: "2026-03-04",
            reason: "Fever",
            leaveType: "medical",
            notes: "",
          } as never,
          ADMIN,
        ),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.insertPending).not.toHaveBeenCalled();
  });

  it("files a pending request under the acting user", async () => {
    mocks.insertPending.mockResolvedValue("leave-new");
    mocks.findById.mockResolvedValue(leave({ id: "leave-new" }));

    const created = await runWithTenant("demo", () =>
      attendanceExcuseUseCases.submitExcuse(
        {
          studentId: "student-1",
          fromDate: "2026-03-02",
          toDate: "2026-03-04",
          reason: "Fever",
          leaveType: "medical",
          notes: "",
        } as never,
        ADMIN,
      ),
    );

    expect(mocks.insertPending).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ studentId: "student-1", submittedBy: "u-admin" }),
    );
    expect(created.id).toBe("leave-new");
  });
});

describe("reviewExcuse", () => {
  it("converts covered unexcused absences on approval and audits each", async () => {
    mocks.findById.mockResolvedValue(leave());
    mocks.decide.mockResolvedValue(leave({ status: "approved", reviewedBy: "u-admin" }));
    mocks.excuseAbsences.mockResolvedValue([
      {
        id: "att-1",
        studentId: "student-1",
        classId: "class-a",
        date: "2026-03-02",
        previousStatus: "absent",
        previousNotes: "",
      },
      {
        id: "att-2",
        studentId: "student-1",
        classId: "class-a",
        date: "2026-03-03",
        previousStatus: "absent",
        previousNotes: "",
      },
    ]);

    await runWithTenant("demo", () =>
      attendanceExcuseUseCases.reviewExcuse("leave-1", { decision: "approve", note: "ok" }, ADMIN),
    );

    expect(mocks.excuseAbsences).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        studentId: "student-1",
        fromDate: "2026-03-02",
        toDate: "2026-03-04",
      }),
    );
    // Two mark conversions + one leave decision.
    expect(mocks.audit).toHaveBeenCalledTimes(3);
    expect(mocks.notify).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ kind: "attendance_leave_decided" }),
    );
  });

  it("does not touch marks when rejecting", async () => {
    mocks.findById.mockResolvedValue(leave());
    mocks.decide.mockResolvedValue(leave({ status: "rejected" }));

    await runWithTenant("demo", () =>
      attendanceExcuseUseCases.reviewExcuse("leave-1", { decision: "reject" }, ADMIN),
    );

    expect(mocks.excuseAbsences).not.toHaveBeenCalled();
  });

  it("refuses to decide an already-decided request", async () => {
    mocks.findById.mockResolvedValue(leave({ status: "approved" }));
    await expect(
      runWithTenant("demo", () =>
        attendanceExcuseUseCases.reviewExcuse("leave-1", { decision: "reject" }, ADMIN),
      ),
    ).rejects.toMatchObject({ statusCode: 409, type: "attendance_leave_invalid_transition" });
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it("refuses when another reviewer won the race (guarded update matched nothing)", async () => {
    mocks.findById.mockResolvedValue(leave());
    mocks.decide.mockResolvedValue(null);
    await expect(
      runWithTenant("demo", () =>
        attendanceExcuseUseCases.reviewExcuse("leave-1", { decision: "approve" }, ADMIN),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.excuseAbsences).not.toHaveBeenCalled();
  });
});

describe("cancelExcuse", () => {
  it("revokes an approved leave without rewriting the marks it excused", async () => {
    mocks.findById.mockResolvedValue(leave({ status: "approved" }));
    mocks.cancel.mockResolvedValue(leave({ status: "cancelled" }));

    const cancelled = await runWithTenant("demo", () =>
      attendanceExcuseUseCases.cancelExcuse("leave-1", { reason: "Returned early" }, ADMIN),
    );

    expect(cancelled.status).toBe("cancelled");
    expect(mocks.excuseAbsences).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledTimes(1);
  });

  it("refuses to cancel an already rejected request", async () => {
    mocks.findById.mockResolvedValue(leave({ status: "rejected" }));
    await expect(
      runWithTenant("demo", () => attendanceExcuseUseCases.cancelExcuse("leave-1", {}, ADMIN)),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
});

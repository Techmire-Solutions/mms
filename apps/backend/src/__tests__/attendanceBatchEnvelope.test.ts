import { describe, expect, it, vi } from "vitest";
import { assertAttendanceWriteAllowed } from "../attendance/use-cases/attendancePolicyGuard.js";
import type { AttendanceRecord, User } from "@mms/shared";

/**
 * Batch rejection envelope: every failing row is reported, nothing is written.
 *
 * Previously the guard threw on the first invalid row, so a 120-row roster with three bad rows
 * reported one row and the client could not tell what else was wrong.
 */

const ADMIN = { id: "u-admin", role: "admin" } as unknown as User;

const PREFERENCES_BASE = {
  workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
  cutoffTime: "18:00",
  lateThresholdMins: 15,
  autoAbsentAfterMins: 0,
  qrEnabled: false,
  lowAttendanceThreshold: 75,
  absenceStreakThreshold: 3,
  notifyParents: false,
  requireNoteForAbsent: false,
  lockAfterSubmit: false,
  trackHalfDay: false,
  weeklyReport: false,
  attendanceAlerts: false,
  allowManualOverride: false,
  offlineEnabled: false,
  geoTagging: false,
  defaultViewLayout: "table",
};

const PREFERENCES = PREFERENCES_BASE as never;

function fakeStore(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    getAttendanceModulePreferences: vi.fn().mockResolvedValue(PREFERENCES),
    findWorkspaceTimezone: vi.fn().mockResolvedValue("UTC"),
    lockAttendanceStudents: vi.fn().mockResolvedValue(undefined),
    listApprovedLeavesFor: vi.fn().mockResolvedValue([]),
    listLockedAttendanceDayKeys: vi.fn().mockResolvedValue(new Set()),
    ...overrides,
  } as never;
}

function row(studentId: string, date: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `${studentId}-${date}`,
    classId: "cls-1",
    studentId,
    studentName: studentId,
    rollNo: "",
    date,
    status: "absent",
    timeIn: "",
    timeOut: "",
    notes: "",
    ...overrides,
  } as unknown as AttendanceRecord;
}

describe("assertAttendanceWriteAllowed batch envelope", () => {
  it("reports every invalid row in one structured rejection", async () => {
    const store = fakeStore({
      getAttendanceModulePreferences: vi.fn().mockResolvedValue({
        ...PREFERENCES_BASE,
        requireNoteForAbsent: true,
      }),
    });

    const failure = await assertAttendanceWriteAllowed({
      tenant: "demo",
      actor: ADMIN,
      now: new Date("2026-03-02T09:00:00.000Z"),
      rows: [row("std-1", "2026-03-02"), row("std-2", "2026-03-02"), row("std-3", "2026-03-03")],
      store,
    }).catch(
      (
        error: Error & {
          statusCode: number;
          type: string;
          violations?: readonly string[];
          details?: { errors?: Array<{ index: number; studentId: string; code: string }> };
        },
      ) => error,
    );

    expect(failure).toMatchObject({ statusCode: 422, type: "attendance_batch_rejected" });
    const envelope = failure as unknown as {
      violations: readonly string[];
      details: { errors: Array<{ index: number; studentId: string; code: string }> };
    };
    expect(envelope.violations).toEqual(["attendance_note_required"]);
    expect(envelope.details.errors.map((error) => error.studentId)).toEqual([
      "std-1",
      "std-2",
      "std-3",
    ]);
    // The index points back at the submitted row so the client can highlight it.
    expect(envelope.details.errors.map((error) => error.index)).toEqual([0, 1, 2]);
  });

  it("keeps the ordinary single-error shape for a lone invalid row", async () => {
    const failure = await assertAttendanceWriteAllowed({
      tenant: "demo",
      actor: ADMIN,
      now: new Date("2026-03-02T09:00:00.000Z"),
      rows: [row("std-1", "2026-03-02", { status: "present", timeIn: "08:00", timeOut: "07:00" })],
      store: fakeStore(),
    }).catch((error: Error & { statusCode: number; type: string }) => error);

    expect(failure).toMatchObject({ type: "attendance_time_invalid", statusCode: 400 });
  });

  it("never persists: the guard only validates", async () => {
    const store = fakeStore({
      getAttendanceModulePreferences: vi.fn().mockResolvedValue({
        ...PREFERENCES_BASE,
        requireNoteForAbsent: true,
      }),
    });

    await expect(
      assertAttendanceWriteAllowed({
        tenant: "demo",
        actor: ADMIN,
        rows: [row("std-1", "2026-03-02"), row("std-2", "2026-03-03")],
        store,
      }),
    ).rejects.toMatchObject({ type: "attendance_batch_rejected" });

    // The lock is taken (serialisation) but no write port exists on the guard at all.
    const typed = store as unknown as { lockAttendanceStudents: { mock: { calls: unknown[] } } };
    expect(typed.lockAttendanceStudents.mock.calls).toHaveLength(1);
  });

  it("accepts a fully valid batch on the same day", async () => {
    await expect(
      assertAttendanceWriteAllowed({
        tenant: "demo",
        actor: ADMIN,
        // Marking today, inside the 18:00 cut-off, so no override is involved.
        now: new Date("2026-03-02T09:00:00.000Z"),
        rows: [
          row("std-1", "2026-03-02", { status: "present", timeIn: "07:00", timeOut: "08:30" }),
          row("std-2", "2026-03-02", { status: "absent" }),
        ],
        store: fakeStore(),
      }),
    ).resolves.toMatchObject({ overridden: false });
  });
});

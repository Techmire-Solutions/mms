import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Absence-scan notification semantics.
 *
 * The scan used to notify **then** stamp `notified_at`, while `notify` swallowed its own failure, so a
 * crash duplicated the notification and a failed insert silenced the alert forever. The contract now
 * is: claim atomically, notify with a dedupe key, release the claim only when the notification could
 * not be stored — and cap a mass-absence day with one summary notification.
 */

const mocks = vi.hoisted(() => ({
  listClassMarkedDays: vi.fn(),
  listCountableMarks: vi.fn(),
  upsertAbsenceAlert: vi.fn(),
  claim: vi.fn(),
  release: vi.fn(),
  notify: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../attendance/repository/attendanceEscalationAdapter.js", () => ({
  attendanceEscalationRepository: {
    listClassMarkedDays: mocks.listClassMarkedDays,
    listCountableMarks: mocks.listCountableMarks,
    upsertAbsenceAlert: mocks.upsertAbsenceAlert,
    claimAbsenceAlertNotification: mocks.claim,
    releaseAbsenceAlertNotification: mocks.release,
    markAbsenceAlertNotified: vi.fn(),
    listAbsenceAlerts: vi.fn().mockResolvedValue([]),
    resolveAbsenceAlert: vi.fn(),
  },
}));
vi.mock("../attendance/repository/attendanceCalendarRepositoryAdapter.js", () => ({
  attendanceCalendarRepository: {
    getAttendanceModulePreferences: vi.fn().mockResolvedValue({ absenceStreakThreshold: 3 }),
    findWorkspaceTimezone: vi.fn().mockResolvedValue("UTC"),
    listApprovedLeavesFor: vi.fn().mockResolvedValue([]),
    listLockedAttendanceDayKeys: vi.fn().mockResolvedValue(new Set<string>()),
    lockAttendanceStudents: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("../notifications/use-cases/notificationsUseCases.js", () => ({
  notificationsUseCases: { notify: mocks.notify },
}));
vi.mock("../services/auditTrailService.js", () => ({ recordModernAuditEvent: mocks.audit }));

const { scanAbsenceStreaks, ABSENCE_NOTIFY_MAX_PER_SCAN } =
  await import("../attendance/use-cases/attendanceEscalationUseCases.js");

const DAYS = ["2026-03-02", "2026-03-03", "2026-03-04"];

function seedStudents(count: number): void {
  const students = Array.from({ length: count }, (_, index) => `stu-${index}`);
  mocks.listClassMarkedDays.mockResolvedValue(DAYS.map((date) => ({ classId: "cls-1", date })));
  mocks.listCountableMarks.mockResolvedValue(
    students.flatMap((studentId) =>
      DAYS.map((date) => ({ classId: "cls-1", studentId, date, status: "absent" })),
    ),
  );
  mocks.upsertAbsenceAlert.mockImplementation(
    async (_tenant: string, input: { studentId: string; streakStart: string }) => ({
      id: `alert-${input.studentId}`,
      status: "open",
      notifiedAt: null,
      created: true,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claim.mockResolvedValue(true);
  mocks.release.mockResolvedValue(undefined);
  mocks.notify.mockResolvedValue(true);
  mocks.audit.mockResolvedValue(undefined);
});

describe("scanAbsenceStreaks notifications", () => {
  it("claims then notifies once per streak with a dedupe key", async () => {
    seedStudents(2);
    const scan = await scanAbsenceStreaks("demo", { now: new Date("2026-03-05T00:00:00Z") });

    expect(scan.alertsRaised).toBe(2);
    expect(scan.notified).toBe(2);
    expect(scan.notificationsCapped).toBe(false);
    expect(mocks.claim).toHaveBeenCalledTimes(2);
    expect(mocks.notify).toHaveBeenCalledTimes(2);
    expect(mocks.notify).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        entityType: "attendance_absence_alert",
        entityId: "alert-stu-0",
        dedupeKey: "absence-alert:alert-stu-0",
      }),
    );
  });

  it("releases the claim when the notification could not be stored", async () => {
    seedStudents(1);
    mocks.notify.mockResolvedValue(false);

    const scan = await scanAbsenceStreaks("demo", { now: new Date("2026-03-05T00:00:00Z") });

    expect(scan.notified).toBe(0);
    expect(mocks.release).toHaveBeenCalledWith("demo", "alert-stu-0");
  });

  it("sends nothing when another scan already claimed the alert", async () => {
    seedStudents(1);
    mocks.claim.mockResolvedValue(false);

    const scan = await scanAbsenceStreaks("demo", { now: new Date("2026-03-05T00:00:00Z") });

    expect(scan.notified).toBe(0);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("caps a mass-absence day: per-student alerts up to the ceiling, then one summary", async () => {
    seedStudents(ABSENCE_NOTIFY_MAX_PER_SCAN + 1);

    const scan = await scanAbsenceStreaks("demo", { now: new Date("2026-03-05T00:00:00Z") });

    expect(scan.alertsRaised).toBe(ABSENCE_NOTIFY_MAX_PER_SCAN + 1);
    expect(scan.notified).toBe(ABSENCE_NOTIFY_MAX_PER_SCAN);
    expect(scan.notificationsCapped).toBe(true);
    // Ceiling + the single summary row.
    expect(mocks.notify).toHaveBeenCalledTimes(ABSENCE_NOTIFY_MAX_PER_SCAN + 1);
    expect(mocks.notify).toHaveBeenLastCalledWith(
      "demo",
      expect.objectContaining({
        entityType: "attendance_absence_scan",
        dedupeKey: "absence-scan-summary:demo:2026-03-05",
      }),
    );
    // The capped alert is stamped so it is not retried forever.
    expect(mocks.claim).toHaveBeenCalledTimes(ABSENCE_NOTIFY_MAX_PER_SCAN + 1);
  });
});

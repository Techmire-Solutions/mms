import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";

const mocks = vi.hoisted(() => ({
  getDaySubmission: vi.fn(),
  upsertDaySubmission: vi.fn(),
  reopenDay: vi.fn(),
  insertApprovedLeaveIfFree: vi.fn(),
}));

vi.mock("../attendance/repository/attendanceCalendarRepositoryAdapter.js", () => ({
  attendanceCalendarRepository: {
    getAttendanceDaySubmission: mocks.getDaySubmission,
    upsertAttendanceDaySubmission: mocks.upsertDaySubmission,
    reopenAttendanceDay: mocks.reopenDay,
    insertApprovedLeaveIfFree: mocks.insertApprovedLeaveIfFree,
  },
}));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn(),
}));
vi.mock("../sessions/use-cases/teacherSectionScope.js", () => ({
  assertTeacherClassScope: vi.fn().mockResolvedValue(undefined),
  assertTeacherSectionScope: vi.fn().mockResolvedValue(undefined),
}));

const { readSubmittedAttendanceDay } =
  await import("../attendance/use-cases/attendanceLeaveUseCases.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readSubmittedAttendanceDay", () => {
  it("returns existing submission when day was submitted", async () => {
    const existing = {
      classId: "cls-1",
      date: "2026-03-02",
      submittedAt: new Date("2026-03-02T09:00:00Z"),
      submittedBy: "u-teacher",
      reopenedAt: null,
      reopenedBy: null,
      reopenReason: null,
      locked: true,
    };
    mocks.getDaySubmission.mockResolvedValue(existing);

    const result = await runWithTenant("demo", () =>
      readSubmittedAttendanceDay("demo", "cls-1", "2026-03-02"),
    );

    expect(result).toEqual(existing);
    expect(mocks.getDaySubmission).toHaveBeenCalledWith("demo", "cls-1", "2026-03-02");
  });

  it("returns zeroed unlocked state when day was never submitted", async () => {
    mocks.getDaySubmission.mockResolvedValue(null);

    const result = await runWithTenant("demo", () =>
      readSubmittedAttendanceDay("demo", "cls-1", "2026-03-02"),
    );

    expect(result).toEqual({
      classId: "cls-1",
      date: "2026-03-02",
      submittedAt: new Date(0),
      submittedBy: null,
      reopenedAt: null,
      reopenedBy: null,
      reopenReason: null,
      locked: false,
    });
    expect(mocks.getDaySubmission).toHaveBeenCalledWith("demo", "cls-1", "2026-03-02");
  });
});

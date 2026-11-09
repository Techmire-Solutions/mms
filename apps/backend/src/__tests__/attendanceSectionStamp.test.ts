import { describe, expect, it, vi, beforeEach } from "vitest";
import { stampAttendanceSections } from "../attendance/use-cases/attendanceSectionStamp.js";
import { attendanceCalendarRepository } from "../attendance/repository/attendanceCalendarRepositoryAdapter.js";

vi.mock("../attendance/repository/attendanceCalendarRepositoryAdapter.js", () => ({
  attendanceCalendarRepository: {
    listEnrollmentPlacements: vi.fn(),
    listEnrollmentPlacementsAsOf: vi.fn(),
    listEnrollmentPlacementsForDates: vi.fn().mockResolvedValue([]),
    findWorkspaceTimezone: vi.fn(),
  },
}));

describe("stampAttendanceSections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(attendanceCalendarRepository.findWorkspaceTimezone).mockResolvedValue("UTC");
    vi.mocked(attendanceCalendarRepository.listEnrollmentPlacementsAsOf).mockResolvedValue([]);
  });

  it("does not pass sectionedOnly: true so unsectioned enrolled students are accepted", async () => {
    vi.mocked(attendanceCalendarRepository.listEnrollmentPlacements).mockResolvedValue([
      { studentId: "std-unsectioned", classId: "cls-1", sectionId: null },
      { studentId: "std-sectioned", classId: "cls-1", sectionId: "sec-alpha" },
    ]);

    const records: Array<{
      studentId: string;
      classId: string;
      date: string;
      sectionId?: string | null;
    }> = [
      { studentId: "std-unsectioned", classId: "cls-1", date: "2099-06-01" },
      { studentId: "std-sectioned", classId: "cls-1", date: "2099-06-01" },
      { studentId: "std-not-enrolled", classId: "cls-1", date: "2099-06-01" },
    ];

    const result = await stampAttendanceSections("test-tenant", records);

    // Verify listEnrollmentPlacements was called without sectionedOnly: true
    expect(attendanceCalendarRepository.listEnrollmentPlacements).toHaveBeenCalledWith(
      "test-tenant",
      ["cls-1"],
      ["std-unsectioned", "std-sectioned", "std-not-enrolled"],
    );

    // Unsectioned student should have sectionId: null and NOT be rejected
    expect(result.records[0]).toEqual({
      studentId: "std-unsectioned",
      classId: "cls-1",
      date: "2099-06-01",
      sectionId: null,
    });

    // Sectioned student should have sectionId: "sec-alpha" and NOT be rejected
    expect(result.records[1]).toEqual({
      studentId: "std-sectioned",
      classId: "cls-1",
      date: "2099-06-01",
      sectionId: "sec-alpha",
    });

    // Not-enrolled student on future date MUST be rejected
    expect(result.rejected).toEqual([
      {
        studentId: "std-not-enrolled",
        classId: "cls-1",
        date: "2099-06-01",
        reason: "not_enrolled",
      },
    ]);
  });

  it("looks up every distinct date in ONE range query (no per-date round-trips)", async () => {
    vi.mocked(attendanceCalendarRepository.listEnrollmentPlacements).mockResolvedValue([
      { studentId: "std-1", classId: "cls-1", sectionId: "sec-live" },
    ]);
    vi.mocked(attendanceCalendarRepository.listEnrollmentPlacementsForDates).mockResolvedValue([
      { date: "2026-03-01", studentId: "std-1", classId: "cls-1", sectionId: "sec-march" },
    ]);

    const records: Array<{
      studentId: string;
      classId: string;
      date: string;
      sectionId?: string | null;
    }> = [
      { studentId: "std-1", classId: "cls-1", date: "2026-03-01" },
      { studentId: "std-1", classId: "cls-1", date: "2026-03-02" },
      { studentId: "std-1", classId: "cls-1", date: "2026-03-03" },
    ];

    const result = await stampAttendanceSections("test-tenant", records);

    // One query for the whole range …
    expect(attendanceCalendarRepository.listEnrollmentPlacementsForDates).toHaveBeenCalledTimes(1);
    expect(attendanceCalendarRepository.listEnrollmentPlacementsForDates).toHaveBeenCalledWith(
      "test-tenant",
      ["cls-1"],
      ["std-1"],
      ["2026-03-01", "2026-03-02", "2026-03-03"],
    );
    // … instead of one per date.
    expect(attendanceCalendarRepository.listEnrollmentPlacementsAsOf).not.toHaveBeenCalled();
    // The dated placement wins where it exists; the live placement is the fallback.
    expect(result.records.map((record) => record.sectionId)).toEqual([
      "sec-march",
      "sec-live",
      "sec-live",
    ]);
  });

  it("permits historical dates without rejection even when not currently enrolled", async () => {
    vi.mocked(attendanceCalendarRepository.listEnrollmentPlacements).mockResolvedValue([]);

    const records: Array<{
      studentId: string;
      classId: string;
      date: string;
      sectionId?: string | null;
    }> = [{ studentId: "std-historical", classId: "cls-1", date: "2000-01-01" }];

    const result = await stampAttendanceSections("test-tenant", records);

    expect(result.rejected).toEqual([]);
    expect(result.records[0]?.sectionId).toBeNull();
  });
});

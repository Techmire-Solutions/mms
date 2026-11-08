import { describe, expect, it, vi, beforeEach } from "vitest";
import { stampAttendanceSections } from "../attendance/use-cases/attendanceSectionStamp.js";
import { attendanceCalendarRepository } from "../attendance/repository/attendanceCalendarRepositoryAdapter.js";

vi.mock("../attendance/repository/attendanceCalendarRepositoryAdapter.js", () => ({
  attendanceCalendarRepository: {
    listEnrollmentPlacements: vi.fn(),
    listEnrollmentPlacementsAsOf: vi.fn(),
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

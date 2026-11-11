import { describe, expect, it } from "vitest";
import {
  calculateFacultyWorkload,
  detectScheduleCollisions,
  hasScheduleOverlap,
  timeStringToMinutes,
  DEFAULT_FACULTY_WORKLOAD_LIMITS,
  type FacultyCourseSectionAllocation,
  type FacultyScheduleSlot,
} from "../faculty/facultyWorkload.js";

describe("facultyWorkloadCalculations", () => {
  describe("timeStringToMinutes", () => {
    it("parses valid 24h clock strings into minutes", () => {
      expect(timeStringToMinutes("00:00")).toBe(0);
      expect(timeStringToMinutes("08:30")).toBe(510);
      expect(timeStringToMinutes("12:00")).toBe(720);
      expect(timeStringToMinutes("14:45")).toBe(885);
      expect(timeStringToMinutes("23:59")).toBe(1439);
    });

    it("handles whitespace and invalid inputs safely", () => {
      expect(timeStringToMinutes("  09:00  ")).toBe(540);
      expect(timeStringToMinutes("")).toBe(0);
      expect(timeStringToMinutes("invalid")).toBe(0);
      expect(timeStringToMinutes(null as unknown as string)).toBe(0);
    });
  });

  describe("calculateFacultyWorkload", () => {
    it("returns available tier with zero stats for empty allocations", () => {
      const summary = calculateFacultyWorkload([]);
      expect(summary.totalCredits).toBe(0);
      expect(summary.totalContactHours).toBe(0);
      expect(summary.totalStudents).toBe(0);
      expect(summary.sectionCount).toBe(0);
      expect(summary.tier).toBe("available");
      expect(summary.isUnderloaded).toBe(false);
      expect(summary.isOverallocated).toBe(false);
      expect(summary.isHoursExceeded).toBe(false);
      expect(summary.warnings).toHaveLength(0);
    });

    it("calculates normal moderate workload correctly", () => {
      const allocations: FacultyCourseSectionAllocation[] = [
        {
          id: "sec-1",
          courseCode: "ISL101",
          credits: 3,
          contactHoursPerWeek: 3,
          enrolledStudents: 25,
        },
        {
          id: "sec-2",
          courseCode: "ARB102",
          credits: 3,
          contactHoursPerWeek: 4,
          enrolledStudents: 20,
        },
      ];

      const summary = calculateFacultyWorkload(allocations);
      expect(summary.totalCredits).toBe(6);
      expect(summary.totalContactHours).toBe(7);
      expect(summary.totalStudents).toBe(45);
      expect(summary.sectionCount).toBe(2);
      expect(summary.tier).toBe("moderate");
      expect(summary.isUnderloaded).toBe(false);
      expect(summary.isOverallocated).toBe(false);
      expect(summary.isHoursExceeded).toBe(false);
      expect(summary.warnings).toHaveLength(0);
    });

    it("detects underloaded faculty when credit count is below minimum limit", () => {
      const allocations: FacultyCourseSectionAllocation[] = [
        {
          id: "sec-1",
          courseCode: "TUT100",
          credits: 1,
          contactHoursPerWeek: 1,
          enrolledStudents: 5,
        },
      ];

      const summary = calculateFacultyWorkload(allocations);
      expect(summary.totalCredits).toBe(1);
      expect(summary.isUnderloaded).toBe(true);
      expect(summary.isOverallocated).toBe(false);
      expect(summary.tier).toBe("moderate");
      expect(summary.warnings).toContain(
        `Total teaching credits (1) is below minimum required (${DEFAULT_FACULTY_WORKLOAD_LIMITS.minCredits})`,
      );
    });

    it("detects heavy workload tier without exceeding caps", () => {
      const allocations: FacultyCourseSectionAllocation[] = [
        { id: "sec-1", credits: 3, contactHoursPerWeek: 3, enrolledStudents: 30 },
        { id: "sec-2", credits: 3, contactHoursPerWeek: 3, enrolledStudents: 28 },
        { id: "sec-3", credits: 3, contactHoursPerWeek: 3, enrolledStudents: 25 },
        { id: "sec-4", credits: 3, contactHoursPerWeek: 3, enrolledStudents: 20 },
      ];

      const summary = calculateFacultyWorkload(allocations);
      expect(summary.totalCredits).toBe(12);
      expect(summary.totalContactHours).toBe(12);
      expect(summary.sectionCount).toBe(4);
      expect(summary.tier).toBe("heavy");
      expect(summary.isOverallocated).toBe(false);
    });

    it("flags overallocated faculty exceeding maximum teaching credits", () => {
      const allocations: FacultyCourseSectionAllocation[] = [
        { id: "sec-1", credits: 4, contactHoursPerWeek: 4 },
        { id: "sec-2", credits: 4, contactHoursPerWeek: 4 },
        { id: "sec-3", credits: 4, contactHoursPerWeek: 4 },
        { id: "sec-4", credits: 4, contactHoursPerWeek: 4 },
        { id: "sec-5", credits: 4, contactHoursPerWeek: 4 }, // 20 credits > 18 limit
      ];

      const summary = calculateFacultyWorkload(allocations);
      expect(summary.totalCredits).toBe(20);
      expect(summary.isOverallocated).toBe(true);
      expect(summary.tier).toBe("overallocated");
      expect(summary.warnings).toContain(
        "Total teaching credits (20) exceeds maximum allowed limit (18)",
      );
    });

    it("flags overallocated faculty exceeding section count limit", () => {
      const allocations: FacultyCourseSectionAllocation[] = [
        { id: "sec-1", credits: 2 },
        { id: "sec-2", credits: 2 },
        { id: "sec-3", credits: 2 },
        { id: "sec-4", credits: 2 },
        { id: "sec-5", credits: 2 },
        { id: "sec-6", credits: 2 },
        { id: "sec-7", credits: 2 }, // 7 sections > 6 limit
      ];

      const summary = calculateFacultyWorkload(allocations);
      expect(summary.sectionCount).toBe(7);
      expect(summary.isOverallocated).toBe(true);
      expect(summary.tier).toBe("overallocated");
      expect(summary.warnings).toContain("Section count (7) exceeds maximum allowed sections (6)");
    });

    it("flags contact hours limit exceeded even if credits are within limits", () => {
      const allocations: FacultyCourseSectionAllocation[] = [
        { id: "sec-1", credits: 3, contactHoursPerWeek: 9 }, // intensive lab
        { id: "sec-2", credits: 3, contactHoursPerWeek: 9 },
        { id: "sec-3", credits: 3, contactHoursPerWeek: 9 }, // total contact hours = 27 > 24
      ];

      const summary = calculateFacultyWorkload(allocations);
      expect(summary.totalCredits).toBe(9);
      expect(summary.totalContactHours).toBe(27);
      expect(summary.isHoursExceeded).toBe(true);
      expect(summary.tier).toBe("overallocated");
      expect(summary.warnings).toContain("Weekly contact hours (27) exceeds maximum limit (24)");
    });

    it("respects custom workload limit overrides", () => {
      const allocations: FacultyCourseSectionAllocation[] = [
        { id: "sec-1", credits: 3, contactHoursPerWeek: 4 },
        { id: "sec-2", credits: 3, contactHoursPerWeek: 4 },
      ];

      const customLimits = {
        minCredits: 8, // department requires 8 credits
        maxCredits: 12,
        maxContactHoursPerWeek: 16,
        maxSections: 3,
      };

      const summary = calculateFacultyWorkload(allocations, customLimits);
      expect(summary.totalCredits).toBe(6);
      expect(summary.isUnderloaded).toBe(true);
      expect(summary.warnings).toContain(
        "Total teaching credits (6) is below minimum required (8)",
      );
    });
  });

  describe("scheduleCollisionDetection", () => {
    it("does not report overlap between the same slot", () => {
      const slot: FacultyScheduleSlot = {
        id: "slot-1",
        dayOfWeek: 1,
        startTimeMinutes: 540,
        endTimeMinutes: 630,
      };
      expect(hasScheduleOverlap(slot, slot)).toBe(false);
    });

    it("does not report overlap on different days of the week", () => {
      const slotA: FacultyScheduleSlot = {
        id: "slot-1",
        dayOfWeek: 1, // Monday
        startTimeMinutes: 540, // 09:00
        endTimeMinutes: 630, // 10:30
      };
      const slotB: FacultyScheduleSlot = {
        id: "slot-2",
        dayOfWeek: 2, // Tuesday
        startTimeMinutes: 540, // 09:00
        endTimeMinutes: 630, // 10:30
      };
      expect(hasScheduleOverlap(slotA, slotB)).toBe(false);
      expect(detectScheduleCollisions([slotA, slotB])).toHaveLength(0);
    });

    it("does not report overlap for contiguous non-overlapping slots on same day", () => {
      const slotA: FacultyScheduleSlot = {
        id: "slot-1",
        dayOfWeek: 1,
        startTimeMinutes: 540, // 09:00
        endTimeMinutes: 600, // 10:00
      };
      const slotB: FacultyScheduleSlot = {
        id: "slot-2",
        dayOfWeek: 1,
        startTimeMinutes: 600, // 10:00
        endTimeMinutes: 660, // 11:00
      };
      expect(hasScheduleOverlap(slotA, slotB)).toBe(false);
      expect(detectScheduleCollisions([slotA, slotB])).toHaveLength(0);
    });

    it("detects timetable collision between overlapping lecture and lab session", () => {
      const lectureSlot: FacultyScheduleSlot = {
        id: "lecture-101",
        label: "Islamic History Lecture",
        dayOfWeek: 1,
        startTimeMinutes: 540, // 09:00
        endTimeMinutes: 630, // 10:30
        kind: "lecture",
      };
      const labSlot: FacultyScheduleSlot = {
        id: "lab-201",
        label: "Arabic Calligraphy Lab",
        dayOfWeek: 1,
        startTimeMinutes: 600, // 10:00
        endTimeMinutes: 720, // 12:00
        kind: "lab",
      };

      expect(hasScheduleOverlap(lectureSlot, labSlot)).toBe(true);

      const collisions = detectScheduleCollisions([lectureSlot, labSlot]);
      expect(collisions).toHaveLength(1);
      expect(collisions[0].slotA.id).toBe("lecture-101");
      expect(collisions[0].slotB.id).toBe("lab-201");
      expect(collisions[0].overlapMinutes).toBe(30); // 10:00 to 10:30 = 30 minutes
    });

    it("detects collision when one slot completely encloses another (e.g. committee block)", () => {
      const committeeSlot: FacultyScheduleSlot = {
        id: "comm-1",
        label: "Curriculum Committee Meeting",
        dayOfWeek: 3,
        startTimeMinutes: 540, // 09:00
        endTimeMinutes: 720, // 12:00
        kind: "committee",
      };
      const officeHoursSlot: FacultyScheduleSlot = {
        id: "office-1",
        label: "Office Hours",
        dayOfWeek: 3,
        startTimeMinutes: 600, // 10:00
        endTimeMinutes: 660, // 11:00
        kind: "office_hours",
      };

      const collisions = detectScheduleCollisions([committeeSlot, officeHoursSlot]);
      expect(collisions).toHaveLength(1);
      expect(collisions[0].overlapMinutes).toBe(60); // 10:00 to 11:00 = 60 minutes
    });
  });
});

/**
 * @file facultyWorkload.ts
 * @description Faculty workload allocation engine, credit calculations, and schedule collision detection.
 */

export interface FacultyCourseSectionAllocation {
  id: string;
  courseCode?: string;
  courseTitle?: string;
  sectionNumber?: string | number;
  credits: number;
  contactHoursPerWeek?: number;
  enrolledStudents?: number;
}

export interface FacultyScheduleSlot {
  id: string;
  label?: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday) or 1-7 (Monday-Sunday)
  startTimeMinutes: number; // minutes from midnight, e.g. 09:30 -> 570
  endTimeMinutes: number; // minutes from midnight, e.g. 11:00 -> 660
  kind?: "lecture" | "lab" | "office_hours" | "committee";
}

export interface FacultyWorkloadLimits {
  minCredits?: number;
  maxCredits?: number;
  maxContactHoursPerWeek?: number;
  maxSections?: number;
}

export const DEFAULT_FACULTY_WORKLOAD_LIMITS: Readonly<Required<FacultyWorkloadLimits>> = {
  minCredits: 3,
  maxCredits: 18,
  maxContactHoursPerWeek: 24,
  maxSections: 6,
};

export type FacultyWorkloadTier = "available" | "moderate" | "heavy" | "overallocated";

export interface FacultyWorkloadSummary {
  totalCredits: number;
  totalContactHours: number;
  totalStudents: number;
  sectionCount: number;
  tier: FacultyWorkloadTier;
  isUnderloaded: boolean;
  isOverallocated: boolean;
  isHoursExceeded: boolean;
  warnings: string[];
}

export interface ScheduleCollision {
  slotA: FacultyScheduleSlot;
  slotB: FacultyScheduleSlot;
  overlapMinutes: number;
}

/** Converts "HH:mm" time string (e.g. "09:30", "14:15") to minutes from midnight. */
export function timeStringToMinutes(time: string): number {
  if (!time || typeof time !== "string") return 0;
  const parts = time.trim().split(":");
  if (parts.length < 2) return 0;
  const hours = Number.parseInt(parts[0], 10);
  const minutes = Number.parseInt(parts[1], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

/** Computes total credits, contact hours, student headcounts, and validates against workload caps. */
export function calculateFacultyWorkload(
  allocations: FacultyCourseSectionAllocation[],
  limits: FacultyWorkloadLimits = {},
): FacultyWorkloadSummary {
  const effectiveLimits = { ...DEFAULT_FACULTY_WORKLOAD_LIMITS, ...limits };

  let totalCredits = 0;
  let totalContactHours = 0;
  let totalStudents = 0;

  for (const item of allocations) {
    totalCredits += Math.max(0, item.credits || 0);
    totalContactHours += Math.max(0, item.contactHoursPerWeek ?? item.credits ?? 0);
    totalStudents += Math.max(0, item.enrolledStudents || 0);
  }

  const sectionCount = allocations.length;
  const isOverallocated =
    totalCredits > effectiveLimits.maxCredits || sectionCount > effectiveLimits.maxSections;
  const isHoursExceeded = totalContactHours > effectiveLimits.maxContactHoursPerWeek;
  const isUnderloaded = sectionCount > 0 && totalCredits < effectiveLimits.minCredits;

  const warnings: string[] = [];
  if (isOverallocated) {
    if (totalCredits > effectiveLimits.maxCredits) {
      warnings.push(
        `Total teaching credits (${totalCredits}) exceeds maximum allowed limit (${effectiveLimits.maxCredits})`,
      );
    }
    if (sectionCount > effectiveLimits.maxSections) {
      warnings.push(
        `Section count (${sectionCount}) exceeds maximum allowed sections (${effectiveLimits.maxSections})`,
      );
    }
  }

  if (isHoursExceeded) {
    warnings.push(
      `Weekly contact hours (${totalContactHours}) exceeds maximum limit (${effectiveLimits.maxContactHoursPerWeek})`,
    );
  }

  if (isUnderloaded) {
    warnings.push(
      `Total teaching credits (${totalCredits}) is below minimum required (${effectiveLimits.minCredits})`,
    );
  }

  let tier: FacultyWorkloadTier = "available";
  if (isOverallocated || isHoursExceeded) {
    tier = "overallocated";
  } else if (sectionCount >= 3 || totalCredits >= 12) {
    tier = "heavy";
  } else if (sectionCount > 0) {
    tier = "moderate";
  }

  return {
    totalCredits,
    totalContactHours,
    totalStudents,
    sectionCount,
    tier,
    isUnderloaded,
    isOverallocated,
    isHoursExceeded,
    warnings,
  };
}

/** Checks whether two schedule slots on the same day overlap in time. */
export function hasScheduleOverlap(
  slotA: FacultyScheduleSlot,
  slotB: FacultyScheduleSlot,
): boolean {
  if (slotA.id === slotB.id) return false;
  if (slotA.dayOfWeek !== slotB.dayOfWeek) return false;
  return (
    slotA.startTimeMinutes < slotB.endTimeMinutes && slotA.endTimeMinutes > slotB.startTimeMinutes
  );
}

/** Detects all pairwise timetable collisions across lectures, labs, office hours, and committee slots. */
export function detectScheduleCollisions(slots: FacultyScheduleSlot[]): ScheduleCollision[] {
  const collisions: ScheduleCollision[] = [];
  const count = slots.length;

  for (let i = 0; i < count; i++) {
    const slotA = slots[i];
    for (let j = i + 1; j < count; j++) {
      const slotB = slots[j];
      if (hasScheduleOverlap(slotA, slotB)) {
        const overlapStart = Math.max(slotA.startTimeMinutes, slotB.startTimeMinutes);
        const overlapEnd = Math.min(slotA.endTimeMinutes, slotB.endTimeMinutes);
        collisions.push({
          slotA,
          slotB,
          overlapMinutes: Math.max(0, overlapEnd - overlapStart),
        });
      }
    }
  }

  return collisions;
}

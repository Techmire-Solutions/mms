import {
  normalizeSessionStatus,
  type Session,
  type SessionFaculty,
  type Class,
  type SessionClassFee,
  type SessionClassSchedule,
  type SessionClassBudget,
  type SessionClassDiscount,
  type SessionClassTimetable,
  type SessionClassTimetablePeriod,
  type SessionClassRefreshment,
  type SessionClassScholarship,
  type ScholarshipEligibility,
} from "@mms/shared";
import {
  type sessions,
  type sessionFaculty,
  type sessionClasses,
  type sessionClassFees,
  type sessionClassSchedules,
  type sessionClassBudgets,
  type sessionClassDiscounts,
  type sessionClassTimetables,
  type sessionClassTimetablePeriods,
  type sessionClassRefreshments,
  type scholarshipEligibilities,
  type sessionClassScholarships,
} from "../schema.js";
import { mapAuditTimestamps, nullsToUndefined } from "./repositoryMappers.js";

type SessionRow = typeof sessions.$inferSelect;
type SessionFacultyRow = typeof sessionFaculty.$inferSelect;
type ClassRow = typeof sessionClasses.$inferSelect;
type FeeRow = typeof sessionClassFees.$inferSelect;
type ScheduleRow = typeof sessionClassSchedules.$inferSelect;
type BudgetRow = typeof sessionClassBudgets.$inferSelect;
type DiscountRow = typeof sessionClassDiscounts.$inferSelect;
type TimetableRow = typeof sessionClassTimetables.$inferSelect;
type PeriodRow = typeof sessionClassTimetablePeriods.$inferSelect;
type RefreshmentRow = typeof sessionClassRefreshments.$inferSelect;
type ScholarshipRow = typeof sessionClassScholarships.$inferSelect;
type EligibilityRow = typeof scholarshipEligibilities.$inferSelect;

export function sessionRowToRecord(
  row: SessionRow,
  facultyRows: SessionFacultyRow[] = [],
  classRows: ClassRow[] = [],
  feeRows: FeeRow[] = [],
  scheduleRows: ScheduleRow[] = [],
  budgetRows: BudgetRow[] = [],
  discountRows: DiscountRow[] = [],
  timetableRows: TimetableRow[] = [],
  periodRows: PeriodRow[] = [],
  refreshmentRows: RefreshmentRow[] = [],
  scholarshipRows: ScholarshipRow[] = [],
  eligibilityRows: EligibilityRow[] = [],
): Session {
  const eligibilityMap = new Map<string, ScholarshipEligibility>();
  for (const el of eligibilityRows) {
    eligibilityMap.set(el.id, {
      id: el.id,
      orphan: Boolean(el.orphan),
      job: Boolean(el.job),
      business: Boolean(el.business),
      property: Boolean(el.property),
      familyMembers: el.familyMembers ?? 1,
      onJobMembers: el.onJobMembers ?? 0,
      schoolGoingSiblings: el.schoolGoingSiblings ?? 0,
      residence: el.residence || "rental",
      notes: el.notes || undefined,
    });
  }

  const periodsByTimetable = new Map<string, SessionClassTimetablePeriod[]>();
  for (const p of periodRows) {
    const arr = periodsByTimetable.get(p.timetableId) || [];
    arr.push({
      id: p.id,
      timetableId: p.timetableId,
      startTime: p.startTime,
      endTime: p.endTime,
      subject: p.subject,
      subjectId: p.subjectId || "",
      facultyId: p.facultyId || "",
      facultyName: p.facultyName || "",
    });
    periodsByTimetable.set(p.timetableId, arr);
  }

  const timetablesByClass = new Map<string, SessionClassTimetable[]>();
  for (const t of timetableRows) {
    const arr = timetablesByClass.get(t.sessionClassId) || [];
    arr.push({
      id: t.id,
      classId: t.sessionClassId,
      date: t.date ?? "",
      periods: periodsByTimetable.get(t.id) || [],
    });
    timetablesByClass.set(t.sessionClassId, arr);
  }

  const feesByClass = new Map<string, SessionClassFee[]>();
  for (const f of feeRows) {
    const arr = feesByClass.get(f.sessionClassId) || [];
    arr.push({
      id: f.id,
      classId: f.sessionClassId,
      feeType: f.feeType,
      amount: Number(f.amount) || 0,
    });
    feesByClass.set(f.sessionClassId, arr);
  }

  const schedulesByClass = new Map<string, SessionClassSchedule[]>();
  for (const s of scheduleRows) {
    const arr = schedulesByClass.get(s.sessionClassId) || [];
    arr.push({
      id: s.id,
      classId: s.sessionClassId,
      scheduleType: s.scheduleType,
      startDate: s.startDate ?? "",
      endDate: s.endDate ?? "",
    });
    schedulesByClass.set(s.sessionClassId, arr);
  }

  const budgetsByClass = new Map<string, SessionClassBudget[]>();
  for (const b of budgetRows) {
    const arr = budgetsByClass.get(b.sessionClassId) || [];
    arr.push({
      id: b.id,
      classId: b.sessionClassId,
      budgetType: (b.budgetType === "income" ? "income" : "expense") as "income" | "expense",
      detail: b.detail,
      amount: Number(b.amount) || 0,
    });
    budgetsByClass.set(b.sessionClassId, arr);
  }

  const discountsByClass = new Map<string, SessionClassDiscount[]>();
  for (const d of discountRows) {
    const arr = discountsByClass.get(d.sessionClassId) || [];
    arr.push({
      id: d.id,
      classId: d.sessionClassId,
      discountType: d.discountType,
      percentage: Number(d.percentage) || 0,
      startDate: d.startDate || "",
      endDate: d.endDate || "",
      eligibilityCriteria: d.eligibilityCriteria as Record<string, unknown>,
      status: (d.status || "active") as "active" | "expired" | "inactive",
    });
    discountsByClass.set(d.sessionClassId, arr);
  }

  const refreshmentsByClass = new Map<string, SessionClassRefreshment[]>();
  for (const r of refreshmentRows) {
    const arr = refreshmentsByClass.get(r.sessionClassId) || [];
    arr.push({
      id: r.id,
      classId: r.sessionClassId,
      date: r.date ?? "",
      item: r.item,
      quantity: r.quantity,
      pricePerUnit: Number(r.pricePerUnit) || 0,
      paidAmount: Number(r.paidAmount) || 0,
    });
    refreshmentsByClass.set(r.sessionClassId, arr);
  }

  const scholarshipsByClass = new Map<string, SessionClassScholarship[]>();
  for (const sc of scholarshipRows) {
    const arr = scholarshipsByClass.get(sc.sessionClassId) || [];
    arr.push({
      id: sc.id,
      classId: sc.sessionClassId,
      scholarshipEligibilityId: sc.scholarshipEligibilityId || undefined,
      eligibility: sc.scholarshipEligibilityId
        ? eligibilityMap.get(sc.scholarshipEligibilityId)
        : undefined,
      percentage: Number(sc.percentage) || 0,
      expiryDate: sc.expiryDate || "",
    });
    scholarshipsByClass.set(sc.sessionClassId, arr);
  }

  const mappedFaculty: SessionFaculty[] = facultyRows.map((f) => ({
    id: f.id,
    sessionId: f.sessionId,
    facultyId: f.facultyId,
    facultyName: f.facultyName || "",
    role: f.role || "coordinator",
    status: (f.status === "inactive" ? "inactive" : "active") as "active" | "inactive",
    createdAt: f.createdAt
      ? f.createdAt instanceof Date
        ? f.createdAt.toISOString()
        : String(f.createdAt)
      : undefined,
  }));

  const mappedClasses: Class[] = classRows.map((c) => {
    const raw = nullsToUndefined(c);
    return {
      id: raw.id,
      sessionId: raw.sessionId,
      name: raw.name,
      gender: (raw.gender === "male" || raw.gender === "female" ? raw.gender : "mixed") as
        "male" | "female" | "mixed",
      ageCalculationDate: raw.ageCalculationDate || "",
      minAge: raw.ageMin ?? 4,
      maxAge: raw.ageMax ?? 25,
      maxStudents: raw.capacity ?? 30,
      enrolled: raw.enrolled ?? 0,
      enrollmentDeadline: raw.enrollmentDeadline || "",
      status: (raw.status === "inactive" ? "inactive" : "active") as "active" | "inactive",
      facultyId: raw.facultyId || "",
      facultyName: raw.facultyName || "",
      room: raw.room || "",
      programId: raw.programId || "",
      fees: feesByClass.get(raw.id) || [],
      schedules: schedulesByClass.get(raw.id) || [],
      budgets: budgetsByClass.get(raw.id) || [],
      discounts: discountsByClass.get(raw.id) || [],
      timetables: timetablesByClass.get(raw.id) || [],
      refreshments: refreshmentsByClass.get(raw.id) || [],
      scholarships: scholarshipsByClass.get(raw.id) || [],
    };
  });

  const rowNorm = nullsToUndefined(row);
  return {
    id: rowNorm.id,
    name: rowNorm.name,
    status: normalizeSessionStatus(rowNorm.status),
    type: rowNorm.type || "academic",
    categoryId: rowNorm.categoryId || "",
    programId: rowNorm.programId || "",
    startDate: rowNorm.startDate || "",
    endDate: rowNorm.endDate || "",
    baseFee: Number(rowNorm.baseFee) || 0,
    currency: rowNorm.currency || "PKR",
    description: rowNorm.description || undefined,
    minAttendancePct: row.minAttendancePct ?? null,
    requiresExamPass: row.requiresExamPass ?? false,
    faculty: mappedFaculty,
    classes: mappedClasses,
    ...mapAuditTimestamps(row),
  } satisfies Session;
}

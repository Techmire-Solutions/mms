import { and, eq, inArray, sql } from "drizzle-orm";
import { type Session } from "@mms/shared";
import {
  type sessions,
  sessionFaculty,
  sessionClasses,
  sessionClassFees,
  sessionClassSchedules,
  sessionClassBudgets,
  sessionClassDiscounts,
  sessionClassTimetables,
  sessionClassTimetablePeriods,
  sessionClassRefreshments,
  scholarshipEligibilities,
  sessionClassScholarships,
} from "../schema.js";
import { type TenantTransaction } from "../tenant-context.js";
import { sessionRowToRecord } from "./sessionRepositoryMappers.js";
import { enrollmentHoldsSeatSql } from "./enrollmentSeatSql.js";

type Transaction = TenantTransaction;
type SessionRow = typeof sessions.$inferSelect;

export async function hydrateSessionsListBatched(
  tx: Transaction,
  subdomain: string,
  sessionRows: SessionRow[],
): Promise<Session[]> {
  const sessionIds = sessionRows.map((s) => s.id);

  // 1. Batch load Session Faculty and Session Classes
  const [facultyRows, classesRows] = await Promise.all([
    tx
      .select({
        id: sessionFaculty.id,
        workspaceSubdomain: sessionFaculty.workspaceSubdomain,
        sessionId: sessionFaculty.sessionId,
        facultyId: sessionFaculty.facultyId,
        facultyName: sessionFaculty.facultyName,
        role: sessionFaculty.role,
        status: sessionFaculty.status,
        createdAt: sessionFaculty.createdAt,
      })
      .from(sessionFaculty)
      .where(
        and(
          eq(sessionFaculty.workspaceSubdomain, subdomain),
          inArray(sessionFaculty.sessionId, sessionIds),
        ),
      ),
    tx
      .select({
        id: sessionClasses.id,
        workspaceSubdomain: sessionClasses.workspaceSubdomain,
        sessionId: sessionClasses.sessionId,
        name: sessionClasses.name,
        gender: sessionClasses.gender,
        ageCalculationDate: sessionClasses.ageCalculationDate,
        ageMin: sessionClasses.ageMin,
        ageMax: sessionClasses.ageMax,
        capacity: sessionClasses.capacity,
        enrolled: sql<number>`(SELECT count(*)::int FROM enrollments e WHERE e.workspace_subdomain = ${sessionClasses.workspaceSubdomain} AND e.session_id = ${sessionClasses.sessionId} AND e.class_id = ${sessionClasses.id} AND e.deleted_at IS NULL AND ${enrollmentHoldsSeatSql("e")})`,
        enrollmentDeadline: sessionClasses.enrollmentDeadline,
        status: sessionClasses.status,
        facultyId: sessionClasses.facultyId,
        facultyName: sessionClasses.facultyName,
        room: sessionClasses.room,
        programId: sessionClasses.programId,
        sortOrder: sessionClasses.sortOrder,
        createdAt: sessionClasses.createdAt,
      })
      .from(sessionClasses)
      .where(
        and(
          eq(sessionClasses.workspaceSubdomain, subdomain),
          inArray(sessionClasses.sessionId, sessionIds),
        ),
      )
      .orderBy(sessionClasses.sortOrder),
  ]);

  const classIds = classesRows.map((c) => c.id);

  // If no classes exist, map sessions with faculty only
  if (classIds.length === 0) {
    const facultyMap = new Map<string, typeof facultyRows>();
    for (const f of facultyRows) {
      const list = facultyMap.get(f.sessionId) ?? [];
      list.push(f);
      facultyMap.set(f.sessionId, list);
    }
    return sessionRows.map((row) => sessionRowToRecord(row, facultyMap.get(row.id) ?? [], []));
  }

  // 2. Batch load Class-level children
  const [
    feeRows,
    scheduleRows,
    budgetRows,
    discountRows,
    timetableRows,
    refreshmentRows,
    scholarshipRows,
  ] = await Promise.all([
    tx
      .select({
        id: sessionClassFees.id,
        workspaceSubdomain: sessionClassFees.workspaceSubdomain,
        sessionClassId: sessionClassFees.sessionClassId,
        feeType: sessionClassFees.feeType,
        amount: sessionClassFees.amount,
        createdAt: sessionClassFees.createdAt,
      })
      .from(sessionClassFees)
      .where(and(eq(sessionClassFees.workspaceSubdomain, subdomain), inArray(sessionClassFees.sessionClassId, classIds))),
    tx
      .select({
        id: sessionClassSchedules.id,
        workspaceSubdomain: sessionClassSchedules.workspaceSubdomain,
        sessionClassId: sessionClassSchedules.sessionClassId,
        scheduleType: sessionClassSchedules.scheduleType,
        startDate: sessionClassSchedules.startDate,
        endDate: sessionClassSchedules.endDate,
        createdAt: sessionClassSchedules.createdAt,
      })
      .from(sessionClassSchedules)
      .where(and(eq(sessionClassSchedules.workspaceSubdomain, subdomain), inArray(sessionClassSchedules.sessionClassId, classIds))),
    tx
      .select({
        id: sessionClassBudgets.id,
        workspaceSubdomain: sessionClassBudgets.workspaceSubdomain,
        sessionClassId: sessionClassBudgets.sessionClassId,
        budgetType: sessionClassBudgets.budgetType,
        detail: sessionClassBudgets.detail,
        amount: sessionClassBudgets.amount,
        createdAt: sessionClassBudgets.createdAt,
      })
      .from(sessionClassBudgets)
      .where(and(eq(sessionClassBudgets.workspaceSubdomain, subdomain), inArray(sessionClassBudgets.sessionClassId, classIds))),
    tx
      .select({
        id: sessionClassDiscounts.id,
        workspaceSubdomain: sessionClassDiscounts.workspaceSubdomain,
        sessionClassId: sessionClassDiscounts.sessionClassId,
        discountType: sessionClassDiscounts.discountType,
        percentage: sessionClassDiscounts.percentage,
        startDate: sessionClassDiscounts.startDate,
        endDate: sessionClassDiscounts.endDate,
        eligibilityCriteria: sessionClassDiscounts.eligibilityCriteria,
        status: sessionClassDiscounts.status,
        createdAt: sessionClassDiscounts.createdAt,
      })
      .from(sessionClassDiscounts)
      .where(and(eq(sessionClassDiscounts.workspaceSubdomain, subdomain), inArray(sessionClassDiscounts.sessionClassId, classIds))),
    tx
      .select({
        id: sessionClassTimetables.id,
        workspaceSubdomain: sessionClassTimetables.workspaceSubdomain,
        sessionClassId: sessionClassTimetables.sessionClassId,
        date: sessionClassTimetables.date,
        createdAt: sessionClassTimetables.createdAt,
      })
      .from(sessionClassTimetables)
      .where(and(eq(sessionClassTimetables.workspaceSubdomain, subdomain), inArray(sessionClassTimetables.sessionClassId, classIds))),
    tx
      .select({
        id: sessionClassRefreshments.id,
        workspaceSubdomain: sessionClassRefreshments.workspaceSubdomain,
        sessionClassId: sessionClassRefreshments.sessionClassId,
        date: sessionClassRefreshments.date,
        item: sessionClassRefreshments.item,
        quantity: sessionClassRefreshments.quantity,
        pricePerUnit: sessionClassRefreshments.pricePerUnit,
        paidAmount: sessionClassRefreshments.paidAmount,
        createdAt: sessionClassRefreshments.createdAt,
      })
      .from(sessionClassRefreshments)
      .where(and(eq(sessionClassRefreshments.workspaceSubdomain, subdomain), inArray(sessionClassRefreshments.sessionClassId, classIds))),
    tx
      .select({
        id: sessionClassScholarships.id,
        workspaceSubdomain: sessionClassScholarships.workspaceSubdomain,
        sessionClassId: sessionClassScholarships.sessionClassId,
        scholarshipEligibilityId: sessionClassScholarships.scholarshipEligibilityId,
        percentage: sessionClassScholarships.percentage,
        expiryDate: sessionClassScholarships.expiryDate,
        createdAt: sessionClassScholarships.createdAt,
      })
      .from(sessionClassScholarships)
      .where(and(eq(sessionClassScholarships.workspaceSubdomain, subdomain), inArray(sessionClassScholarships.sessionClassId, classIds))),
  ]);

  // 3. Batch load Timetable periods and Scholarship eligibilities
  const timetableIds = timetableRows.map((t) => t.id);
  const eligibilityIds = scholarshipRows
    .map((s) => s.scholarshipEligibilityId)
    .filter((id): id is string => Boolean(id));

  const [periodRows, eligibilityRows] = await Promise.all([
    timetableIds.length > 0
      ? tx
          .select({
            id: sessionClassTimetablePeriods.id,
            workspaceSubdomain: sessionClassTimetablePeriods.workspaceSubdomain,
            timetableId: sessionClassTimetablePeriods.timetableId,
            startTime: sessionClassTimetablePeriods.startTime,
            endTime: sessionClassTimetablePeriods.endTime,
            subject: sessionClassTimetablePeriods.subject,
            subjectId: sessionClassTimetablePeriods.subjectId,
            facultyId: sessionClassTimetablePeriods.facultyId,
            facultyName: sessionClassTimetablePeriods.facultyName,
            createdAt: sessionClassTimetablePeriods.createdAt,
          })
          .from(sessionClassTimetablePeriods)
          .where(and(eq(sessionClassTimetablePeriods.workspaceSubdomain, subdomain), inArray(sessionClassTimetablePeriods.timetableId, timetableIds)))
      : Promise.resolve([]),
    eligibilityIds.length > 0
      ? tx
          .select({
            id: scholarshipEligibilities.id,
            workspaceSubdomain: scholarshipEligibilities.workspaceSubdomain,
            orphan: scholarshipEligibilities.orphan,
            job: scholarshipEligibilities.job,
            business: scholarshipEligibilities.business,
            property: scholarshipEligibilities.property,
            familyMembers: scholarshipEligibilities.familyMembers,
            onJobMembers: scholarshipEligibilities.onJobMembers,
            schoolGoingSiblings: scholarshipEligibilities.schoolGoingSiblings,
            residence: scholarshipEligibilities.residence,
            notes: scholarshipEligibilities.notes,
            createdAt: scholarshipEligibilities.createdAt,
          })
          .from(scholarshipEligibilities)
          .where(and(eq(scholarshipEligibilities.workspaceSubdomain, subdomain), inArray(scholarshipEligibilities.id, eligibilityIds)))
      : Promise.resolve([]),
  ]);

  // Group by session and class
  const facultyBySession = new Map<string, typeof facultyRows>();
  for (const f of facultyRows) {
    const list = facultyBySession.get(f.sessionId) ?? [];
    list.push(f);
    facultyBySession.set(f.sessionId, list);
  }

  const classesBySession = new Map<string, typeof classesRows>();
  for (const c of classesRows) {
    const list = classesBySession.get(c.sessionId) ?? [];
    list.push(c);
    classesBySession.set(c.sessionId, list);
  }

  return sessionRows.map((row) =>
    sessionRowToRecord(
      row,
      facultyBySession.get(row.id) ?? [],
      classesBySession.get(row.id) ?? [],
      feeRows,
      scheduleRows,
      budgetRows,
      discountRows,
      timetableRows,
      periodRows,
      refreshmentRows,
      scholarshipRows,
      eligibilityRows,
    ),
  );
}

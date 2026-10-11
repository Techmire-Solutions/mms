import { and, eq, inArray } from "drizzle-orm";
import { type Class } from "@mms/shared";
import { randomUUID } from "node:crypto";
import {
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

type Transaction = TenantTransaction;

export async function persistSessionClassesTx(
  tx: Transaction,
  subdomain: string,
  sessionId: string,
  classes?: Class[],
): Promise<void> {
  // 1. Clear existing classes and class-level sub-tables
  const existingClasses = await tx
    .select({ id: sessionClasses.id })
    .from(sessionClasses)
    .where(
      and(
        eq(sessionClasses.workspaceSubdomain, subdomain),
        eq(sessionClasses.sessionId, sessionId),
      ),
    );

  const existingClassIds = existingClasses.map((c) => c.id);

  if (existingClassIds.length > 0) {
    const existingTimetables = await tx
      .select({ id: sessionClassTimetables.id })
      .from(sessionClassTimetables)
      .where(
        and(
          eq(sessionClassTimetables.workspaceSubdomain, subdomain),
          inArray(sessionClassTimetables.sessionClassId, existingClassIds),
        ),
      );
    const existingTimetableIds = existingTimetables.map((t) => t.id);

    if (existingTimetableIds.length > 0) {
      await tx
        .delete(sessionClassTimetablePeriods)
        .where(
          and(
            eq(sessionClassTimetablePeriods.workspaceSubdomain, subdomain),
            inArray(sessionClassTimetablePeriods.timetableId, existingTimetableIds),
          ),
        );
    }

    await Promise.all([
      tx
        .delete(sessionClassFees)
        .where(
          and(
            eq(sessionClassFees.workspaceSubdomain, subdomain),
            inArray(sessionClassFees.sessionClassId, existingClassIds),
          ),
        ),
      tx
        .delete(sessionClassSchedules)
        .where(
          and(
            eq(sessionClassSchedules.workspaceSubdomain, subdomain),
            inArray(sessionClassSchedules.sessionClassId, existingClassIds),
          ),
        ),
      tx
        .delete(sessionClassBudgets)
        .where(
          and(
            eq(sessionClassBudgets.workspaceSubdomain, subdomain),
            inArray(sessionClassBudgets.sessionClassId, existingClassIds),
          ),
        ),
      tx
        .delete(sessionClassDiscounts)
        .where(
          and(
            eq(sessionClassDiscounts.workspaceSubdomain, subdomain),
            inArray(sessionClassDiscounts.sessionClassId, existingClassIds),
          ),
        ),
      tx
        .delete(sessionClassTimetables)
        .where(
          and(
            eq(sessionClassTimetables.workspaceSubdomain, subdomain),
            inArray(sessionClassTimetables.sessionClassId, existingClassIds),
          ),
        ),
      tx
        .delete(sessionClassRefreshments)
        .where(
          and(
            eq(sessionClassRefreshments.workspaceSubdomain, subdomain),
            inArray(sessionClassRefreshments.sessionClassId, existingClassIds),
          ),
        ),
      tx
        .delete(sessionClassScholarships)
        .where(
          and(
            eq(sessionClassScholarships.workspaceSubdomain, subdomain),
            inArray(sessionClassScholarships.sessionClassId, existingClassIds),
          ),
        ),
    ]);

    await tx
      .delete(sessionClasses)
      .where(
        and(
          eq(sessionClasses.workspaceSubdomain, subdomain),
          eq(sessionClasses.sessionId, sessionId),
        ),
      );
  }

  // 2. Insert new classes and their sub-graphs
  if (!classes || classes.length === 0) return;

  const classInserts: Array<typeof sessionClasses.$inferInsert> = [];
  const feeInserts: Array<typeof sessionClassFees.$inferInsert> = [];
  const scheduleInserts: Array<typeof sessionClassSchedules.$inferInsert> = [];
  const budgetInserts: Array<typeof sessionClassBudgets.$inferInsert> = [];
  const discountInserts: Array<typeof sessionClassDiscounts.$inferInsert> = [];
  const refreshmentInserts: Array<typeof sessionClassRefreshments.$inferInsert> = [];
  const timetableInserts: Array<typeof sessionClassTimetables.$inferInsert> = [];
  const periodInserts: Array<typeof sessionClassTimetablePeriods.$inferInsert> = [];
  const scholarshipInserts: Array<typeof sessionClassScholarships.$inferInsert> = [];

  for (let idx = 0; idx < classes.length; idx++) {
    const c = classes[idx];
    const classId = c.id || randomUUID();

    classInserts.push({
      id: classId,
      workspaceSubdomain: subdomain,
      sessionId,
      name: c.name,
      gender: c.gender || "mixed",
      ageCalculationDate: c.ageCalculationDate || "",
      ageMin: c.minAge ?? 4,
      ageMax: c.maxAge ?? 25,
      capacity: c.maxStudents ?? 30,
      enrolled: c.enrolled ?? 0,
      enrollmentDeadline: c.enrollmentDeadline || "",
      status: c.status || "active",
      facultyId: c.facultyId?.trim() ? c.facultyId.trim() : null,
      facultyName: c.facultyName || "",
      room: c.room || "",
      sortOrder: idx,
    });

    for (const fee of c.fees || []) {
      feeInserts.push({
        id: fee.id || randomUUID(),
        workspaceSubdomain: subdomain,
        sessionClassId: classId,
        feeType: fee.feeType,
        amount: String(fee.amount ?? 0),
      });
    }

    for (const s of c.schedules || []) {
      scheduleInserts.push({
        id: s.id || randomUUID(),
        workspaceSubdomain: subdomain,
        sessionClassId: classId,
        scheduleType: s.scheduleType,
        startDate: s.startDate,
        endDate: s.endDate,
      });
    }

    for (const b of c.budgets || []) {
      budgetInserts.push({
        id: b.id || randomUUID(),
        workspaceSubdomain: subdomain,
        sessionClassId: classId,
        budgetType: b.budgetType,
        detail: b.detail,
        amount: String(b.amount ?? 0),
      });
    }

    for (const d of c.discounts || []) {
      discountInserts.push({
        id: d.id || randomUUID(),
        workspaceSubdomain: subdomain,
        sessionClassId: classId,
        discountType: d.discountType,
        percentage: String(d.percentage ?? 0),
        startDate: d.startDate || null,
        endDate: d.endDate || null,
        eligibilityCriteria: d.eligibilityCriteria || {},
        status: d.status || "active",
      });
    }

    for (const r of c.refreshments || []) {
      refreshmentInserts.push({
        id: r.id || randomUUID(),
        workspaceSubdomain: subdomain,
        sessionClassId: classId,
        date: r.date,
        item: r.item,
        quantity: r.quantity ?? 1,
        pricePerUnit: String(r.pricePerUnit ?? 0),
        paidAmount: String(r.paidAmount ?? 0),
      });
    }

    for (const t of c.timetables || []) {
      const timetableId = t.id || randomUUID();
      timetableInserts.push({
        id: timetableId,
        workspaceSubdomain: subdomain,
        sessionClassId: classId,
        date: t.date,
      });
      for (const p of t.periods || []) {
        periodInserts.push({
          id: p.id || randomUUID(),
          workspaceSubdomain: subdomain,
          timetableId,
          startTime: p.startTime,
          endTime: p.endTime,
          subject: p.subject,
          facultyId: p.facultyId?.trim() ? p.facultyId.trim() : null,
          facultyName: p.facultyName || "",
        });
      }
    }

    for (const sc of c.scholarships || []) {
      let eligibilityId = sc.scholarshipEligibilityId;
      if (sc.eligibility) {
        eligibilityId = sc.eligibility.id || randomUUID();
        await tx
          .insert(scholarshipEligibilities)
          .values({
            id: eligibilityId,
            workspaceSubdomain: subdomain,
            orphan: sc.eligibility.orphan,
            job: sc.eligibility.job,
            business: sc.eligibility.business,
            property: sc.eligibility.property,
            familyMembers: sc.eligibility.familyMembers,
            onJobMembers: sc.eligibility.onJobMembers,
            schoolGoingSiblings: sc.eligibility.schoolGoingSiblings,
            residence: sc.eligibility.residence,
            notes: sc.eligibility.notes || null,
          })
          .onConflictDoUpdate({
            target: [scholarshipEligibilities.workspaceSubdomain, scholarshipEligibilities.id],
            set: {
              orphan: sc.eligibility.orphan,
              job: sc.eligibility.job,
              business: sc.eligibility.business,
              property: sc.eligibility.property,
              familyMembers: sc.eligibility.familyMembers,
              onJobMembers: sc.eligibility.onJobMembers,
              schoolGoingSiblings: sc.eligibility.schoolGoingSiblings,
              residence: sc.eligibility.residence,
              notes: sc.eligibility.notes || null,
            },
          });
      }

      scholarshipInserts.push({
        id: sc.id || randomUUID(),
        workspaceSubdomain: subdomain,
        sessionClassId: classId,
        scholarshipEligibilityId: eligibilityId || null,
        percentage: String(sc.percentage ?? 0),
        expiryDate: sc.expiryDate || "",
      });
    }
  }

  if (classInserts.length > 0) await tx.insert(sessionClasses).values(classInserts);
  if (feeInserts.length > 0) await tx.insert(sessionClassFees).values(feeInserts);
  if (scheduleInserts.length > 0) await tx.insert(sessionClassSchedules).values(scheduleInserts);
  if (budgetInserts.length > 0) await tx.insert(sessionClassBudgets).values(budgetInserts);
  if (discountInserts.length > 0) await tx.insert(sessionClassDiscounts).values(discountInserts);
  if (refreshmentInserts.length > 0)
    await tx.insert(sessionClassRefreshments).values(refreshmentInserts);
  if (timetableInserts.length > 0) await tx.insert(sessionClassTimetables).values(timetableInserts);
  if (periodInserts.length > 0) await tx.insert(sessionClassTimetablePeriods).values(periodInserts);
  if (scholarshipInserts.length > 0)
    await tx.insert(sessionClassScholarships).values(scholarshipInserts);
}

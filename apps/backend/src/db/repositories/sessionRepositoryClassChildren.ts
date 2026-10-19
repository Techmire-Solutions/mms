import { and, eq, inArray } from "drizzle-orm";
import { type Class } from "@mms/shared";
import { randomUUID } from "node:crypto";
import {
  sessionClassFees,
  sessionClassSchedules,
  sessionClassBudgets,
  sessionClassDiscounts,
  sessionClassTimetables,
  sessionClassTimetablePeriods,
  sessionClassRefreshments,
  scholarshipEligibilities,
  sessionClassScholarships,
  sessionClassTimetablePeriodStaff,
} from "../schema.js";
import { type TenantTransaction } from "../tenant-context.js";
import { toDbDate } from "../../lib/dbDate.js";

export interface ClassChildRows {
  fees: Array<typeof sessionClassFees.$inferInsert>;
  schedules: Array<typeof sessionClassSchedules.$inferInsert>;
  budgets: Array<typeof sessionClassBudgets.$inferInsert>;
  discounts: Array<typeof sessionClassDiscounts.$inferInsert>;
  refreshments: Array<typeof sessionClassRefreshments.$inferInsert>;
  timetables: Array<typeof sessionClassTimetables.$inferInsert>;
  periods: Array<typeof sessionClassTimetablePeriods.$inferInsert>;
  scholarships: Array<typeof sessionClassScholarships.$inferInsert>;
  eligibilities: Array<typeof scholarshipEligibilities.$inferInsert>;
  periodStaff: Array<typeof sessionClassTimetablePeriodStaff.$inferInsert>;
}

export function emptyClassChildRows(): ClassChildRows {
  return {
    fees: [],
    schedules: [],
    budgets: [],
    discounts: [],
    refreshments: [],
    timetables: [],
    periods: [],
    scholarships: [],
    eligibilities: [],
    periodStaff: [],
  };
}

/** Appends the child rows of one class to `rows` (ids preserved when present). */
export function collectClassChildRows(
  rows: ClassChildRows,
  workspaceSubdomain: string,
  sessionClassId: string,
  c: Class,
): void {
  const base = { workspaceSubdomain, sessionClassId };
  for (const fee of c.fees || []) {
    rows.fees.push({
      ...base,
      id: fee.id || randomUUID(),
      feeType: fee.feeType,
      amount: String(fee.amount ?? 0),
    });
  }
  for (const s of c.schedules || []) {
    rows.schedules.push({
      ...base,
      id: s.id || randomUUID(),
      scheduleType: s.scheduleType,
      startDate: toDbDate(s.startDate),
      endDate: toDbDate(s.endDate),
    });
  }
  for (const b of c.budgets || []) {
    rows.budgets.push({
      ...base,
      id: b.id || randomUUID(),
      budgetType: b.budgetType,
      detail: b.detail,
      amount: String(b.amount ?? 0),
    });
  }
  for (const d of c.discounts || []) {
    rows.discounts.push({
      ...base,
      id: d.id || randomUUID(),
      discountType: d.discountType,
      percentage: String(d.percentage ?? 0),
      startDate: toDbDate(d.startDate),
      endDate: toDbDate(d.endDate),
      eligibilityCriteria: d.eligibilityCriteria || {},
      status: d.status || "active",
    });
  }
  for (const r of c.refreshments || []) {
    rows.refreshments.push({
      ...base,
      id: r.id || randomUUID(),
      date: toDbDate(r.date),
      item: r.item,
      quantity: r.quantity ?? 1,
      pricePerUnit: String(r.pricePerUnit ?? 0),
      paidAmount: String(r.paidAmount ?? 0),
    });
  }
  for (const t of c.timetables || []) {
    const timetableId = t.id || randomUUID();
    rows.timetables.push({ ...base, id: timetableId, date: toDbDate(t.date) });
    for (const p of t.periods || []) {
      const periodId = p.id || randomUUID();
      for (const facultyId of new Set(
        (p.assistantFacultyIds ?? []).filter((id) => id && id !== p.facultyId),
      )) {
        rows.periodStaff.push({
          id: randomUUID(),
          workspaceSubdomain,
          periodId,
          facultyId,
          role: "assistant",
        });
      }
      rows.periods.push({
        id: periodId,
        workspaceSubdomain,
        timetableId,
        startTime: p.startTime,
        endTime: p.endTime,
        subjectId: p.subjectId || null,
        facultyId: p.facultyId?.trim() ? p.facultyId.trim() : null,
        facultyName: p.facultyName || "",
      });
    }
  }
  for (const sc of c.scholarships || []) {
    let eligibilityId = sc.scholarshipEligibilityId;
    if (sc.eligibility) {
      eligibilityId = sc.eligibility.id || randomUUID();
      rows.eligibilities.push({
        id: eligibilityId,
        workspaceSubdomain,
        orphan: sc.eligibility.orphan,
        job: sc.eligibility.job,
        business: sc.eligibility.business,
        property: sc.eligibility.property,
        familyMembers: sc.eligibility.familyMembers,
        onJobMembers: sc.eligibility.onJobMembers,
        schoolGoingSiblings: sc.eligibility.schoolGoingSiblings,
        residence: sc.eligibility.residence,
        notes: sc.eligibility.notes || null,
      });
    }
    rows.scholarships.push({
      ...base,
      id: sc.id || randomUUID(),
      scholarshipEligibilityId: eligibilityId || null,
      percentage: String(sc.percentage ?? 0),
      expiryDate: toDbDate(sc.expiryDate),
    });
  }
}

/** Deletes every child row (including timetable periods) owned by the given classes. */
export async function deleteClassChildrenTx(
  tx: TenantTransaction,
  subdomain: string,
  classIds: string[],
): Promise<void> {
  if (classIds.length === 0) return;
  const timetables = await tx
    .select({ id: sessionClassTimetables.id })
    .from(sessionClassTimetables)
    .where(
      and(
        eq(sessionClassTimetables.workspaceSubdomain, subdomain),
        inArray(sessionClassTimetables.sessionClassId, classIds),
      ),
    );
  const timetableIds = timetables.map((t) => t.id);
  if (timetableIds.length > 0) {
    const periodIds = (
      await tx
        .select({ id: sessionClassTimetablePeriods.id })
        .from(sessionClassTimetablePeriods)
        .where(
          and(
            eq(sessionClassTimetablePeriods.workspaceSubdomain, subdomain),
            inArray(sessionClassTimetablePeriods.timetableId, timetableIds),
          ),
        )
    ).map((row) => row.id);
    if (periodIds.length > 0) {
      await tx
        .delete(sessionClassTimetablePeriodStaff)
        .where(
          and(
            eq(sessionClassTimetablePeriodStaff.workspaceSubdomain, subdomain),
            inArray(sessionClassTimetablePeriodStaff.periodId, periodIds),
          ),
        );
    }
    await tx
      .delete(sessionClassTimetablePeriods)
      .where(
        and(
          eq(sessionClassTimetablePeriods.workspaceSubdomain, subdomain),
          inArray(sessionClassTimetablePeriods.timetableId, timetableIds),
        ),
      );
  }
  const childTables = [
    sessionClassFees,
    sessionClassSchedules,
    sessionClassBudgets,
    sessionClassDiscounts,
    sessionClassTimetables,
    sessionClassRefreshments,
    sessionClassScholarships,
  ] as const;
  for (const table of childTables) {
    await tx
      .delete(table)
      .where(and(eq(table.workspaceSubdomain, subdomain), inArray(table.sessionClassId, classIds)));
  }
}

export async function insertClassChildRowsTx(
  tx: TenantTransaction,
  rows: ClassChildRows,
): Promise<void> {
  for (const e of rows.eligibilities) {
    const { id: _id, workspaceSubdomain: _ws, ...set } = e;
    await tx
      .insert(scholarshipEligibilities)
      .values(e)
      .onConflictDoUpdate({
        target: [scholarshipEligibilities.workspaceSubdomain, scholarshipEligibilities.id],
        set,
      });
  }
  if (rows.fees.length > 0) await tx.insert(sessionClassFees).values(rows.fees);
  if (rows.schedules.length > 0) await tx.insert(sessionClassSchedules).values(rows.schedules);
  if (rows.budgets.length > 0) await tx.insert(sessionClassBudgets).values(rows.budgets);
  if (rows.discounts.length > 0) await tx.insert(sessionClassDiscounts).values(rows.discounts);
  if (rows.refreshments.length > 0)
    await tx.insert(sessionClassRefreshments).values(rows.refreshments);
  if (rows.timetables.length > 0) await tx.insert(sessionClassTimetables).values(rows.timetables);
  if (rows.periods.length > 0) await tx.insert(sessionClassTimetablePeriods).values(rows.periods);
  if (rows.scholarships.length > 0)
    await tx.insert(sessionClassScholarships).values(rows.scholarships);
  if (rows.periodStaff.length > 0)
    await tx.insert(sessionClassTimetablePeriodStaff).values(rows.periodStaff);
}

import { randomUUID } from "node:crypto";
import type { ImportBatchFn, ImportRowError } from "@mms/shared";
import { runWithTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { throwIfBackgroundJobAborted } from "../../lib/backgroundJobAbort.js";
import { getTimezoneForImport } from "../repository/enrollmentImportRepository.js";
import { enrollmentsUseCases } from "./enrollmentsUseCases.js";
import { planEnrollmentImport, type EnrollmentImportRow } from "./enrollmentImportPlan.js";

export type { EnrollmentImportRow } from "./enrollmentImportPlan.js";

/**
 * Enrollment CSV import persistence.
 *
 * Resolution is prefetched in three queries per batch (students, sessions, live pairs) and
 * duplicate rows are reported instead of silently double-counted; each enrollment still goes
 * through the audited domain create path, so rules/capacity/audit stay intact.
 */
export const importEnrollmentRows: ImportBatchFn<EnrollmentImportRow> = async (rows, ctx) => {
  const today = todayInTimeZone(await getTimezoneForImport(ctx.tenant));
  throwIfBackgroundJobAborted(ctx.signal);
  const plan = await planEnrollmentImport(ctx.tenant, rows, ctx.offset ?? 0);
  const errors = [...plan.errors];
  let imported = 0;

  for (let index = 0; index < plan.planned.length; index += 1) {
    throwIfBackgroundJobAborted(ctx.signal);
    const planned = plan.planned[index]!;
    try {
      await runWithTenant(ctx.tenant, () =>
        enrollmentsUseCases.createEnrollment({
          id: randomUUID(),
          studentId: planned.studentId,
          studentName: planned.studentName,
          sessionId: planned.session.id,
          sessionName: planned.session.name,
          classId: planned.cls.id,
          className: planned.cls.name ?? "",
          ...(planned.sectionId ? { sectionId: planned.sectionId } : {}),
          enrolledDate: planned.enrolledDate || today,
          baseFee: planned.baseFee,
          discountType: planned.discountType,
          discountLabel: planned.discountLabel,
          discountPct: planned.discountPct,
          discountAmt: planned.discountAmt,
          finalFee: planned.finalFee,
          status: planned.status,
          paymentStatus: planned.paymentStatus as never,
          notes: planned.notes,
          invoiceId: null,
          timeline: [],
        } as never),
      );
      imported += 1;
    } catch (error) {
      errors.push({
        row: planned.rowNumber,
        reason: error instanceof Error ? error.message : "Enrollment failed",
      });
    }
    if ((imported + errors.length) % 25 === 0) {
      await ctx.updateProgress(imported + errors.length, Math.max(rows.length, 1));
    }
  }

  return { imported, errors };
};

/** Read-only pre-flight: resolves the whole batch and reports row errors/duplicates. */
export async function preflightEnrollmentImport(
  tenant: string,
  rows: readonly EnrollmentImportRow[],
): Promise<{
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  errors: ImportRowError[];
  preview: Array<{
    row: number;
    studentId: string;
    sessionId: string;
    classId: string;
    status: string;
  }>;
}> {
  const plan = await planEnrollmentImport(tenant, rows, 0);
  return {
    total: rows.length,
    valid: rows.length - plan.errors.length,
    invalid: plan.errors.length,
    duplicates: plan.duplicates,
    errors: plan.errors.slice(0, 500),
    preview: plan.planned.slice(0, 20).map((item) => ({
      row: item.rowNumber,
      studentId: item.studentId,
      sessionId: item.session.id,
      classId: item.cls.id,
      status: item.status,
    })),
  };
}

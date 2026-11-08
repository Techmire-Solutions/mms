import { randomUUID } from "node:crypto";
import {
  enrollmentFeeForClass,
  parseEnrollmentStatus,
  type ImportBatchFn,
  type ImportRowError,
  type Session,
} from "@mms/shared";
import type { z } from "zod";
import type { enrollmentImportRowSchema } from "@mms/shared";
import { runWithTenant } from "../../lib/tenantContext.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { throwIfBackgroundJobAborted } from "../../lib/backgroundJobAbort.js";
import {
  getHydratedSessionForImport,
  getHydratedStudentForImport,
  getTimezoneForImport,
  hasLiveEnrollmentInSession,
  lookupImportSessionIds,
  lookupImportStudentIds,
} from "../repository/enrollmentImportRepository.js";
import { enrollmentsUseCases } from "./enrollmentsUseCases.js";

export type EnrollmentImportRow = z.infer<typeof enrollmentImportRowSchema>;

interface ResolvedStudent {
  id: string;
  name: string;
  discountType?: string | null;
  discountPct?: number | null;
}

/** Row-level failure carrying a clear, user-facing reason. */
function rowError(row: number, reason: string): ImportRowError {
  return { row, reason };
}

async function resolveStudent(
  tenant: string,
  row: EnrollmentImportRow,
): Promise<{ student?: ResolvedStudent; error?: string }> {
  const matches = await lookupImportStudentIds(tenant, row);
  if (matches.length === 0) return { error: "Student not found" };
  if (matches.length > 1) {
    return { error: "Student name matches more than one student — import by studentId" };
  }
  const student = await getHydratedStudentForImport(tenant, String(matches[0]!.id));
  if (!student) return { error: "Student not found" };
  return {
    student: {
      id: String(student.id),
      name: student.name || "",
      discountType: student.discountType ?? null,
      discountPct: student.discountPct != null ? Number(student.discountPct) : null,
    },
  };
}

async function resolveSession(
  tenant: string,
  row: EnrollmentImportRow,
): Promise<{ session?: Session; error?: string }> {
  const idValue = (row.sessionId ?? "").trim();
  const nameValue = (row.sessionName ?? "").trim();
  if (!idValue && !nameValue) return { error: "Session is required" };
  const rows = await lookupImportSessionIds(tenant, row);
  if (rows.length === 0) return { error: "Session not found" };
  if (rows.length > 1)
    return { error: "Session name matches more than one session — use sessionId" };
  const session = await getHydratedSessionForImport(tenant, String(rows[0]!.id));
  if (!session) return { error: "Session not found" };
  return { session };
}

function resolveClass(
  session: Session,
  row: EnrollmentImportRow,
): {
  cls?: Session["classes"][number];
  error?: string;
} {
  const idValue = (row.classId ?? "").trim();
  const nameValue = (row.className ?? "").trim();
  const classes = session.classes ?? [];
  if (!idValue && !nameValue) return { error: "Class is required" };
  const matches = classes.filter((cls) =>
    idValue
      ? cls.id === idValue
      : (cls.name ?? "").trim().toLowerCase() === nameValue.toLowerCase(),
  );
  if (matches.length === 0) return { error: "Class not found in the session" };
  if (matches.length > 1) return { error: "Class name is ambiguous — import by classId" };
  return { cls: matches[0]! };
}

function parseRowDate(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

/**
 * Enrollment CSV import persistence.
 *
 * Each row resolves student/session/class, then creates the enrollment through the same
 * domain path as the REST API (validation, seat locks, audit, SSOT). Retries are idempotent:
 * a row whose live enrollment already exists is counted as imported instead of duplicated.
 * Aborts are observed per row so shutdown/timeout cannot keep writing while a retry starts.
 */
export const importEnrollmentRows: ImportBatchFn<EnrollmentImportRow> = async (rows, ctx) => {
  const errors: ImportRowError[] = [];
  const today = todayInTimeZone(await getTimezoneForImport(ctx.tenant));
  let imported = 0;

  for (let index = 0; index < rows.length; index += 1) {
    throwIfBackgroundJobAborted(ctx.signal);
    const row = rows[index]!;
    const rowNumber = (ctx.offset ?? 0) + index + 1;

    const { student, error: studentError } = await resolveStudent(ctx.tenant, row);
    if (!student) {
      errors.push(rowError(rowNumber, studentError ?? "Student not found"));
      continue;
    }
    const { session, error: sessionError } = await resolveSession(ctx.tenant, row);
    if (!session) {
      errors.push(rowError(rowNumber, sessionError ?? "Session not found"));
      continue;
    }
    const { cls, error: classError } = resolveClass(session, row);
    if (!cls) {
      errors.push(rowError(rowNumber, classError ?? "Class not found"));
      continue;
    }
    let status: "pending" | "confirmed";
    try {
      const parsed = parseEnrollmentStatus((row.status ?? "pending").trim().toLowerCase());
      if (parsed !== "pending" && parsed !== "confirmed") {
        errors.push(
          rowError(
            rowNumber,
            `Status "${parsed}" cannot be imported; use the enrolment operations for terminal outcomes`,
          ),
        );
        continue;
      }
      status = parsed;
    } catch {
      errors.push(rowError(rowNumber, `Unknown enrollment status "${row.status}"`));
      continue;
    }

    const enrolledDate = parseRowDate(row.enrolledDate) ?? today;
    if (row.enrolledDate && !parseRowDate(row.enrolledDate)) {
      errors.push(rowError(rowNumber, `Invalid enrolledDate "${row.enrolledDate}"`));
      continue;
    }

    const fee = enrollmentFeeForClass(session.baseFee, cls, student);
    const baseFee = row.baseFee !== undefined ? Number(row.baseFee) : fee.baseFee;
    const discountPct = row.discountPct !== undefined ? Number(row.discountPct) : fee.discountPct;
    const finalFee =
      row.finalFee !== undefined
        ? Number(row.finalFee)
        : Math.max(0, Math.round((baseFee * (100 - discountPct) * 100) / 10000));
    if (!Number.isFinite(baseFee) || !Number.isFinite(finalFee) || !Number.isFinite(discountPct)) {
      errors.push(rowError(rowNumber, "Fee values must be numbers"));
      continue;
    }

    // Retry-safe and skip-safe: an already-live enrollment (including one imported by an
    // earlier attempt of this job) is counted as imported instead of duplicated.
    if (await hasLiveEnrollmentInSession(ctx.tenant, student.id, session.id)) {
      imported += 1;
      continue;
    }

    try {
      await runWithTenant(ctx.tenant, () =>
        enrollmentsUseCases.createEnrollment({
          id: randomUUID(),
          studentId: student.id,
          studentName: student.name,
          sessionId: session.id,
          sessionName: session.name,
          classId: cls.id,
          className: cls.name ?? "",
          ...((row.sectionId ?? cls.sections?.[0]?.id)
            ? { sectionId: row.sectionId ?? cls.sections![0]!.id }
            : {}),
          enrolledDate,
          baseFee,
          discountType: row.discountType?.trim() || fee.discountType,
          discountLabel: fee.discountLabel,
          discountPct,
          discountAmt: Math.max(0, baseFee - finalFee),
          finalFee,
          status,
          paymentStatus: (row.paymentStatus?.trim() || "none") as never,
          notes: row.notes?.trim() || "",
          invoiceId: null,
          timeline: [],
        } as never),
      );
      imported += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        reason: error instanceof Error ? error.message : "Enrollment failed",
      });
    }
    if ((imported + errors.length) % 25 === 0) {
      await ctx.updateProgress(imported + errors.length, Math.max(rows.length, 1));
    }
  }

  return { imported, errors };
};

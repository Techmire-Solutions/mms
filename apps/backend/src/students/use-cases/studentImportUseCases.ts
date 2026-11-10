import { randomUUID } from "node:crypto";
import type { z } from "zod";
import {
  STUDENT_STATUS_VALUES,
  type studentImportRowSchema,
  type Contact,
  type ImportBatchFn,
  type ImportRowError,
} from "@mms/shared";
import { runWithTenant } from "../../lib/tenantContext.js";
import { throwIfBackgroundJobAborted } from "../../lib/backgroundJobAbort.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { withTenant } from "../../db/tenant-context.js";
import { redisGet, redisSet, redisDel } from "../../lib/redis.js";
import { upsertContact } from "../../contacts/use-cases/contactWriteUseCases.js";
import { findContactsMatchingUniqueValues } from "../../contacts/use-cases/contactLoadUseCases.js";
import { createStudent } from "./studentWriteUseCases.js";

/** One validated CSV row as produced by `studentImportRowSchema`. */
export type StudentImportRow = z.infer<typeof studentImportRowSchema>;

const STUDENT_STATUS_SET = new Set<string>(STUDENT_STATUS_VALUES);

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Resolves the person contact for an imported row.
 *
 * Student identity (name, gender, DOB, phone, email, city, CNIC) lives on the linked contact, so an
 * import that skipped this step would create students whose name is unrecoverable. Existing
 * contacts are reused by phone/email first (import must not fork duplicate people); otherwise a
 * contact is created from the row's identity fields.
 */
async function resolveImportContact(row: StudentImportRow): Promise<string> {
  const phone = row.phone?.trim() ?? "";
  const email = row.email?.trim() ?? "";
  const cnic = row.cnic?.trim() ?? "";
  if (phone || email || cnic) {
    const matches = await findContactsMatchingUniqueValues({
      phoneDigits: phone ? [onlyDigits(phone)].filter(Boolean) : [],
      emails: email ? [email.toLowerCase()] : [],
      scalars: cnic ? [{ fieldKey: "cnic", normalized: cnic }] : [],
    });
    const existing = matches[0];
    if (existing) return String(existing.id);
  }

  const name = (row.name ?? "").trim();
  const [firstName, ...rest] = name.split(/\s+/);
  const contact: Contact = {
    id: randomUUID(),
    name,
    firstName: firstName ?? name,
    lastName: rest.join(" ") || undefined,
    gender: row.gender || undefined,
    dob: row.dob || undefined,
    cnic: row.cnic || undefined,
    city: row.city || undefined,
    phone: phone || undefined,
    email: email || undefined,
  };
  const saved = await upsertContact(contact);
  return String(saved.contact.id);
}

/** Student columns sourced from the row; unknown (custom) keys flow through untouched. */
function buildImportPayload(row: StudentImportRow, contactId: string): Record<string, unknown> {
  return {
    ...row,
    contactId,
    // Contact-owned identity is not duplicated onto the student row.
    name: undefined,
    gender: undefined,
    dob: undefined,
    phone: undefined,
    email: undefined,
    city: undefined,
    cnic: undefined,
    fatherName: undefined,
    motherName: undefined,
    guardianName: undefined,
    // Enrollments are owned by the Enrollments module — never created from a student import.
    enrolledSessions: undefined,
    grNumber: row.grNumber?.trim() || undefined,
    studentId: row.studentId?.trim() || undefined,
    status: row.status?.trim() ? row.status.trim().toLowerCase() : undefined,
    registeredDate: row.registeredDate?.trim() || undefined,
    notes: row.notes?.trim() || undefined,
    discountType: row.discountType?.trim() || undefined,
  };
}

/**
 * Persists one validated chunk of the students CSV import.
 *
 * Each row becomes a person contact (reused when the phone/email/CNIC already exists) plus a student
 * linked to it, through the same `createStudent` domain path as the REST API — so GR auto-generation,
 * the strict write allowlist, GR/Student-ID uniqueness and contact-tag reconciliation all apply.
 *
 * Checkpointing: saves progress to Redis so worker retries resume without duplicating already-persisted rows.
 * Row failures are collected and reported by position instead of failing the whole batch.
 */
export const importStudentRows: ImportBatchFn<StudentImportRow> = async (rows, ctx) => {
  const checkpointKey = ctx.jobId ? `mms:${ctx.tenant}:import-checkpoint:${ctx.jobId}` : null;
  let startOffset = 0;
  if (checkpointKey) {
    try {
      const saved = await redisGet(checkpointKey);
      if (saved) {
        startOffset = Math.min(Number(saved), rows.length);
      }
    } catch {
      startOffset = 0;
    }
  }

  const errors: ImportRowError[] = [];
  let imported = 0;

  for (let index = startOffset; index < rows.length; index += 1) {
    throwIfBackgroundJobAborted(ctx.signal);
    const row = rows[index]!;
    // `ctx.offset` is the chunk's position in the original file: one persist call per 200 rows
    // would otherwise report every later chunk's errors as rows 1..200.
    const rowNumber = (ctx.offset ?? 0) + index + 1;
    const name = (row.name ?? "").trim();
    if (!name) {
      errors.push({ row: rowNumber, reason: "Name is required" });
      continue;
    }
    if (row.status && !STUDENT_STATUS_SET.has(row.status.trim().toLowerCase())) {
      errors.push({
        row: rowNumber,
        reason: `Invalid status "${row.status}". Allowed values: ${STUDENT_STATUS_VALUES.join(", ")}`,
      });
      continue;
    }

    try {
      await runWithTenant(ctx.tenant, () =>
        withTenant(
          ctx.tenant,
          async () => {
            const contactId = await resolveImportContact(row);
            await createStudent(buildImportPayload(row, contactId), {
              actorId: ctx.userId,
              // One live-push per chunk (below) instead of one per imported row.
              deferBroadcast: true,
            });
          },
          { readOnly: false },
        ),
      );
      imported += 1;

      // Periodically update checkpoint to absorb worker interruptions
      if (checkpointKey && (index + 1) % 20 === 0) {
        try {
          await redisSet(checkpointKey, String(index + 1), 86400);
        } catch {
          // Non-fatal
        }
      }
      if (ctx.updateProgress && (index + 1) % 10 === 0) {
        void ctx.updateProgress(index + 1, rows.length).catch(() => {});
      }
    } catch (error: unknown) {
      errors.push({
        row: rowNumber,
        reason: error instanceof Error ? error.message : "Import failed",
      });
    }
  }

  if (checkpointKey) {
    try {
      await redisDel(checkpointKey);
    } catch {
      // Non-fatal
    }
  }

  if (imported > 0) await broadcastCollection("students");

  return { imported, errors: errors.length > 0 ? errors : undefined };
};

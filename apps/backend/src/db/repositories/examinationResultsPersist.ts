import { and, eq, inArray, sql } from "drizzle-orm";
import type { ExamResult } from "@mms/shared";
import { examClasses, examResults, exams } from "../schema.js";
import { withTenant, type AppDb } from "../tenant-context.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { assertMarksWritable } from "./examinationMarksLock.js";
import { auditCollectionReplacement } from "./examinationExamsAudit.js";
import {
  EXAM_RESULT_NATURAL_KEY_TARGET,
  EXAM_RESULT_UPSERT_SET,
  EXAM_RESULT_VERSION_MATCH,
  buildMarksAuditDelta,
  examResultIdConflictError,
  examResultNaturalKey,
  examResultStaleWriteError,
  normalizeMarks,
  planExamResultUpsert,
  type MarkInput,
  type StoredMark,
} from "./examResultUpsert.js";

/**
 * Marks persistence — the only writer of `exam_results` on the request path.
 *
 * Split from `examinationResultsRepository.ts` (which keeps the read surface) so the OCC, the
 * publication lock and the audit trail live in one place and stay inside the 300-line band.
 *
 * Invariants enforced here, not in the route layer:
 * - a mark is written against the **business key** `(workspace, exam, student)`;
 * - a save carrying a stale `version` writes nothing and returns 409 (`stale_write`);
 * - published results (and archived exams) are immutable until an administrative unlock;
 * - every actual score change appends an audit event in the same transaction.
 */

type Tx = AppDb;

/** Current marks for the exams in a batch, used to compute the audit delta. */
async function readMarksForExams(
  tx: Tx,
  subdomain: string,
  examIds: readonly string[],
): Promise<StoredMark[]> {
  if (examIds.length === 0) return [];
  return tx
    .select({
      id: examResults.id,
      examId: examResults.examId,
      studentId: examResults.studentId,
      marksObtained: examResults.marksObtained,
    })
    .from(examResults)
    .where(
      and(eq(examResults.workspaceSubdomain, subdomain), inArray(examResults.examId, examIds)),
    );
}

function toInsertValues(subdomain: string, record: ExamResult) {
  const base = {
    id: record.id,
    workspaceSubdomain: subdomain,
    examId: record.examId,
    studentId: record.studentId,
    marksObtained: normalizeMarks(record.marksObtained),
    markedBy: record.markedBy ?? null,
  };
  // The token travels as `excluded.version`, which {@link EXAM_RESULT_VERSION_MATCH} compares.
  return typeof record.version === "number" ? { ...base, version: record.version } : base;
}

/** One `INSERT … ON CONFLICT DO UPDATE`; returns the rows that were actually written. */
async function writeMarksBatch(
  tx: Tx,
  subdomain: string,
  rows: readonly ExamResult[],
  withToken: boolean,
): Promise<MarkInput[]> {
  if (rows.length === 0) return [];
  return tx
    .insert(examResults)
    .values(rows.map((record) => toInsertValues(subdomain, record)))
    .onConflictDoUpdate(
      withToken
        ? {
            target: EXAM_RESULT_NATURAL_KEY_TARGET,
            set: EXAM_RESULT_UPSERT_SET,
            setWhere: EXAM_RESULT_VERSION_MATCH,
          }
        : {
            target: EXAM_RESULT_NATURAL_KEY_TARGET,
            set: EXAM_RESULT_UPSERT_SET,
          },
    )
    .returning({
      id: examResults.id,
      examId: examResults.examId,
      studentId: examResults.studentId,
      marksObtained: examResults.marksObtained,
    });
}

/** `ON CONFLICT … WHERE` silently skips a stale row; a save that wrote nothing must not report success. */
function assertEveryRowWritten(
  written: readonly MarkInput[],
  expected: readonly ExamResult[],
): void {
  if (written.length === expected.length) return;
  const returned = new Set(written.map((row) => examResultNaturalKey(row)));
  const lost = expected.find((record) => !returned.has(examResultNaturalKey(record)));
  throw examResultStaleWriteError(lost ?? {});
}

async function auditMarkChanges(
  tx: Tx,
  subdomain: string,
  before: readonly StoredMark[],
  written: readonly MarkInput[],
  actorId: string | null | undefined,
): Promise<void> {
  const deltas = buildMarksAuditDelta(before, written);
  for (const delta of deltas) {
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "exam_results",
      recordId: delta.recordId,
      actionType: delta.from === null ? "CREATE" : "UPDATE",
      realUserId: actorId ?? null,
      oldState: delta.from === null ? undefined : { marksObtained: delta.from },
      newState: {
        examId: delta.examId,
        studentId: delta.studentId,
        marksObtained: delta.to,
        reason: delta.from === null ? "marks_entry" : "marks_correction",
        reasonCode: delta.from === null ? "marks_entry" : "marks_correction",
      },
      minimizeDelta: true,
    });
  }
}

async function persistMarks(subdomain: string, records: readonly ExamResult[]): Promise<void> {
  if (records.length === 0) return;
  const { withToken, withoutToken } = planExamResultUpsert([...records]);
  const examIds = [...new Set(records.map((record) => String(record.examId)))];
  const actorId = records.find((record) => record.markedBy)?.markedBy ?? null;

  await withTenant(subdomain, async (tx) => {
    await assertMarksWritable(tx, subdomain, examIds);
    const before = await readMarksForExams(tx, subdomain, examIds);
    try {
      const writtenWithoutToken = await writeMarksBatch(tx, subdomain, withoutToken, false);
      const writtenWithToken = await writeMarksBatch(tx, subdomain, withToken, true);
      const written = [...writtenWithoutToken, ...writtenWithToken];
      assertEveryRowWritten(written, [...withoutToken, ...withToken]);
      await auditMarkChanges(tx, subdomain, before, written, actorId);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw examResultIdConflictError(
          String((error as { constraint?: unknown }).constraint ?? "exam_results"),
        );
      }
      throw error;
    }
  });
}

export async function saveExamResult(tenant: string, record: ExamResult): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await persistMarks(subdomain, [record]);
}

export async function bulkSaveExamResults(tenant: string, records: ExamResult[]): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await persistMarks(subdomain, records);
}

/**
 * Whole-collection replace — the backup/restore path only (dbSync runs it under
 * `app.allow_hard_purge`). It deliberately bypasses the publication lock: restoring a snapshot must
 * reproduce what was backed up, including published marks.
 */
export async function replaceExamResultsForWorkspace(
  tenant: string,
  records: ExamResult[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueMap = new Map<string, ExamResult>();
  for (const r of records) {
    const cleanId = typeof r.id === "string" ? r.id.trim() : String(r.id);
    if (cleanId) uniqueMap.set(cleanId, { ...r, id: cleanId });
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    // A whole-collection replacement can rewrite or drop every mark: leave one attributable row.
    const [existing] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(examResults)
      .where(eq(examResults.workspaceSubdomain, subdomain));
    await tx.delete(examResults).where(eq(examResults.workspaceSubdomain, subdomain));
    if (uniqueRecords.length > 0) {
      await tx.insert(examResults).values(
        uniqueRecords.map((r) => ({
          id: r.id,
          workspaceSubdomain: subdomain,
          examId: r.examId,
          studentId: r.studentId,
          marksObtained: normalizeMarks(r.marksObtained),
          markedBy: r.markedBy ?? null,
          version: typeof r.version === "number" ? r.version : 1,
          // A restore must reproduce the moderated result, not just the raw mark: omitting these
          // silently discarded grace marks and their attribution (0238 review).
          graceMarks: r.graceMarks ?? 0,
          moderationReason: r.moderationReason ?? null,
          moderatedBy: r.moderatedBy ?? null,
          moderatedAt: r.moderatedAt ? new Date(r.moderatedAt) : null,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        })),
      );
    }
    await auditCollectionReplacement(
      tx,
      subdomain,
      "exam_results",
      Number(existing?.total ?? 0),
      uniqueRecords.length,
      null,
    );
  });
}

export async function deleteExaminationsByWorkspace(workspaceSubdomain: string): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    // `exams` carries the `forbid_hard_delete` trigger; a workspace purge is the deliberate bypass.
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(examResults).where(eq(examResults.workspaceSubdomain, subdomain));
    await tx.delete(examClasses).where(eq(examClasses.workspaceSubdomain, subdomain));
    await tx.delete(exams).where(eq(exams.workspaceSubdomain, subdomain));
  });
}

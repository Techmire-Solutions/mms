import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { MAX_MARKS_OBTAINED, type ExamResult } from "@mms/shared";
import { examResults } from "../schema.js";
import { ConflictError, ValidationError } from "../../lib/httpErrors.js";

/**
 * Planning helpers for the exam-result upsert.
 *
 * Mirrors `attendanceUpsert.ts`: the rules that keep concurrent grading safe (business key, lock
 * ordering, OCC token handling, score normalisation) are pure functions with direct unit tests so
 * they never depend on a database.
 *
 * Before this existed the upsert arbitrated on the surrogate `id` only while the integrity index is
 * `(workspace_subdomain, exam_id, student_id)` — so a caller that minted a fresh id got a `23505`
 * (a 500) instead of an update, and two examiners saving the same roster overwrote each other's
 * marks with no conflict. See docs/examinations-schema-persistence-audit-2026-11-11.md.
 */

/** The business key of a mark — one row per exam and student. */
export function examResultNaturalKey(record: {
  examId?: string | null;
  studentId?: string | null;
}): string {
  const examId = String(record.examId ?? "").trim();
  const studentId = String(record.studentId ?? "").trim();
  return `${examId}|${studentId}`;
}

/** OCC arbiter: the columns of `exam_results_workspace_exam_student_uidx` (0222/0236). */
export const EXAM_RESULT_NATURAL_KEY_TARGET = [
  examResults.workspaceSubdomain,
  examResults.examId,
  examResults.studentId,
];

/** Columns rewritten on conflict — never `id`/`exam_id`/`student_id`, which are the row's identity. */
export const EXAM_RESULT_UPSERT_SET = {
  marksObtained: sql`excluded.marks_obtained`,
  markedBy: sql`excluded.marked_by`,
  updatedAt: sql`now()`,
  version: sql`${examResults.version} + 1`,
};

/**
 * Per-row OCC predicate: only rows whose token still matches the caller's are written.
 *
 * `excluded.version` carries the token the caller read; a row whose token moved on is skipped, so
 * the write either applies or the caller gets a 409.
 */
export const EXAM_RESULT_VERSION_MATCH = sql`${examResults.version} = excluded.version`;

export function examResultStaleWriteError(record: {
  studentId?: string | null;
  examId?: string | null;
}): ConflictError {
  return new ConflictError(
    `Marks for student ${record.studentId ?? "?"} in exam ${record.examId ?? "?"} were changed by someone else — reload and retry`,
    "stale_write",
  );
}

/** Published results are immutable: writing marks requires an administrative unlock first. */
export function examResultsFinalizedError(examIds: readonly string[]): ConflictError {
  return new ConflictError(
    `Results are published for exam ${examIds.join(", ")} — unpublish them (administrative unlock) before editing marks`,
    "exam_results_finalized",
  );
}

export function examCancelledError(examIds: readonly string[]): ConflictError {
  return new ConflictError(
    `Exam ${examIds.join(", ")} is cancelled — marks and moderation are closed for it`,
    "exam_cancelled",
  );
}

export function examArchivedError(examIds: readonly string[]): ConflictError {
  return new ConflictError(
    `Marks cannot be recorded for archived exam ${examIds.join(", ")} — restore it first`,
    "exam_archived",
  );
}

/** One id may not be reused for a different business key inside a batch. */
export function examResultIdConflictError(id: string): ConflictError {
  return new ConflictError(
    `Exam result id ${id} already belongs to a different exam/student pair`,
    "exam_result_id_conflict",
  );
}

/**
 * Rounds a score to the column's scale and rejects values the column/extended checks cannot hold.
 *
 * `numeric(8,2)` would otherwise reject or silently round a value the UI happily accepts, and a
 * NaN/Infinity reaches Postgres as an invalid literal (22P02 → 500).
 */
export function normalizeMarks(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    throw new ValidationError("Marks must be a finite number");
  }
  // Round the decimal *string*, not the binary double: `85.555 * 100` is 8555.4999…, which would
  // round down here while Postgres (which receives "85.555") rounds it up to 85.56 — the audit
  // delta would then disagree with the stored value.
  const shifted = Number(`${numeric}e2`);
  const scaled = Number.isFinite(shifted) ? Math.round(shifted) : Math.round(numeric * 100);
  const rounded = scaled / 100;
  if (rounded < 0) {
    throw new ValidationError("Marks cannot be negative");
  }
  if (rounded > MAX_MARKS_OBTAINED) {
    throw new ValidationError(`Marks cannot exceed ${MAX_MARKS_OBTAINED}`);
  }
  return rounded;
}

export interface PlannedExamResultUpsert {
  /** Rows carrying the caller's OCC token; written under {@link EXAM_RESULT_VERSION_MATCH}. */
  withToken: ExamResult[];
  /** Rows without a token (legacy clients); last-writer-wins, but `version` still advances. */
  withoutToken: ExamResult[];
}

/**
 * Normalizes a marks batch into the two upsert buckets.
 *
 * - **Dedupe by business key, not by id.** A duplicate key inside one `INSERT … ON CONFLICT`
 *   raises `21000` ("cannot affect row a second time"); the last row for a key wins, matching the
 *   gradebook order.
 * - **Sort by business key.** `ON CONFLICT DO UPDATE` locks rows as it meets them; two examiners
 *   saving overlapping rosters in different orders could take those locks in opposite order and
 *   deadlock (`40P01`). A deterministic order removes the cycle.
 * - **Reject one id used for two keys.** The insert would hit the primary key instead of the
 *   natural key, and a driver-level `23505` is not actionable for the caller.
 * - **Normalize every score** so the row that reaches Postgres is already at column scale.
 */
export function planExamResultUpsert(
  records: readonly ExamResult[],
  idGenerator: () => string = () => `er-${randomUUID()}`,
): PlannedExamResultUpsert {
  const byNaturalKey = new Map<string, ExamResult>();
  for (const record of records) {
    const rawId = typeof record.id === "string" && record.id.trim() !== "" ? record.id.trim() : "";
    const key = examResultNaturalKey(record);
    byNaturalKey.set(key, {
      ...record,
      id: rawId || idGenerator(),
      marksObtained: normalizeMarks(record.marksObtained),
    });
  }

  const ordered = [...byNaturalKey.values()].sort((a, b) =>
    examResultNaturalKey(a).localeCompare(examResultNaturalKey(b)),
  );

  const seenIds = new Map<string, string>();
  for (const record of ordered) {
    const id = String(record.id);
    const key = examResultNaturalKey(record);
    const existing = seenIds.get(id);
    if (existing !== undefined && existing !== key) {
      throw new ValidationError(
        `Exam result id ${id} was used for more than one exam/student pair in the same save`,
      );
    }
    seenIds.set(id, key);
  }

  return {
    withToken: ordered.filter((record) => typeof record.version === "number"),
    withoutToken: ordered.filter((record) => typeof record.version !== "number"),
  };
}

/** A stored mark as read for delta/audit purposes. */
export interface StoredMark {
  id: string;
  examId: string;
  studentId: string;
  marksObtained: number;
}

/** The subset of a mark the delta needs; `RETURNING` rows satisfy it structurally. */
export interface MarkInput {
  id?: string;
  examId: string;
  studentId: string;
  marksObtained: number;
}

export interface MarkDelta {
  recordId: string;
  examId: string;
  studentId: string;
  from: number | null;
  to: number;
}

/**
 * Marks that actually changed, keyed by business key.
 *
 * The audit trail is hash-chained per tenant, so writing one event per row of every roster save
 * would flood it with no-ops. Only real score changes (and first-time entries) produce a delta.
 */
export function buildMarksAuditDelta(
  before: readonly StoredMark[],
  records: readonly MarkInput[],
): MarkDelta[] {
  const byKey = new Map<string, StoredMark>();
  for (const row of before) byKey.set(examResultNaturalKey(row), row);

  const deltas: MarkDelta[] = [];
  for (const record of records) {
    const key = examResultNaturalKey(record);
    const previous = byKey.get(key);
    const next = normalizeMarks(record.marksObtained);
    if (previous && previous.marksObtained === next) continue;
    deltas.push({
      recordId: previous?.id ?? String(record.id ?? ""),
      examId: String(record.examId),
      studentId: String(record.studentId),
      from: previous ? previous.marksObtained : null,
      to: next,
    });
  }
  return deltas;
}

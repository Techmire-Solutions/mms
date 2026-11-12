import { sql } from "drizzle-orm";
import type { QuestionBankQuestion } from "@mms/shared";
import { questions } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import { ConflictError } from "../../lib/httpErrors.js";

/**
 * Question-bank OCC plumbing (migration 0240), extracted from `questionBankQuestionsPersist` so that
 * file stays inside the 300-line ceiling. Mirrors `examResultUpsert.ts` for the marks grid.
 *
 * A record that carries a `version` is compare-and-set: a row whose token moved on is skipped by
 * `ON CONFLICT … WHERE`, so a save either applies or the caller gets a 409. A record without a token
 * (bulk import, restore, legacy callers) keeps the previous last-write-wins behaviour.
 */

/** Per-row token predicate; `excluded.version` carries the value the caller read. */
export const QUESTION_VERSION_MATCH = sql`${questions.version} = excluded.version`;

export function questionStaleWriteError(record: { id?: string }): ConflictError {
  return new ConflictError(
    `Question ${record.id ?? "?"} was changed by someone else — reload and retry`,
    "stale_write",
    record.id ? { id: record.id } : undefined,
  );
}

/**
 * Shared `ON CONFLICT DO UPDATE` projection.
 *
 * Restore provenance: an upsert that clears `deleted_at` resurrects a trashed question, so it must
 * stamp `restored_at`/`restored_by` and clear the cascade flag (`mms-soft-delete` §5) instead of
 * silently dropping the deletion evidence.
 */
export const QUESTION_UPSERT_SET = {
  type: sql`excluded.type`,
  difficulty: sql`excluded.difficulty`,
  questionLanguage: sql`excluded.question_language`,
  text: sql`excluded.text`,
  answer: sql`excluded.answer`,
  marks: sql`excluded.marks`,
  deletedAt: sql`excluded.deleted_at`,
  deletedBy: sql`excluded.deleted_by`,
  deletionReason: sql`excluded.deletion_reason`,
  restoredAt: sql`case when excluded.deleted_at is null and ${questions.deletedAt} is not null then now() else coalesce(excluded.restored_at, ${questions.restoredAt}) end`,
  restoredBy: sql`coalesce(excluded.restored_by, ${questions.restoredBy})`,
  deletedWithCascade: sql`case when excluded.deleted_at is null then false else excluded.deleted_with_cascade end`,
  version: sql`${questions.version} + 1`,
  updatedAt: sql`now()`,
};

export function toQuestionInsert(record: QuestionBankQuestion, subdomain: string) {
  return {
    id: record.id,
    workspaceSubdomain: subdomain,
    type: record.type,
    difficulty: record.difficulty,
    questionLanguage: record.questionLanguage ?? "en",
    text: record.text,
    answer: record.answer,
    marks: record.marks ?? 1,
    // A record without a token keeps the legacy last-write-wins path; inserts start at 1.
    version: record.version ?? 1,
    deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
    deletedBy: record.deletedBy ?? null,
    deletionReason: record.deletionReason ?? null,
    restoredAt: record.restoredAt ? new Date(record.restoredAt) : null,
    restoredBy: record.restoredBy ?? null,
    deletedWithCascade: record.deletedWithCascade ?? false,
    updatedAt: new Date(),
  };
}

/** One upsert for the supplied rows; returns the rows that were actually written. */
export async function upsertQuestionRows(
  tx: TenantTransaction,
  subdomain: string,
  records: readonly QuestionBankQuestion[],
  withToken: boolean,
): Promise<Array<{ id: string }>> {
  if (records.length === 0) return [];
  return tx
    .insert(questions)
    .values(records.map((record) => toQuestionInsert(record, subdomain)))
    .onConflictDoUpdate(
      withToken
        ? {
            target: [questions.workspaceSubdomain, questions.id],
            set: QUESTION_UPSERT_SET,
            setWhere: QUESTION_VERSION_MATCH,
          }
        : {
            target: [questions.workspaceSubdomain, questions.id],
            set: QUESTION_UPSERT_SET,
          },
    )
    .returning({ id: questions.id });
}

/** `ON CONFLICT … WHERE` silently skips a stale row; a save that wrote nothing must not report success. */
export function assertEveryQuestionWritten(
  written: readonly { id: string }[],
  expected: readonly QuestionBankQuestion[],
): void {
  if (written.length === expected.length) return;
  const returned = new Set(written.map((row) => row.id));
  const lost = expected.find((record) => !returned.has(record.id));
  throw questionStaleWriteError(lost ?? {});
}

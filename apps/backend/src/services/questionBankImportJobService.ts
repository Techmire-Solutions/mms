import { createHash } from "node:crypto";
import type { QuestionBankQuestion } from "@mms/shared";
import {
  transferRowToQuestionInput,
  type QuestionImportCandidate,
  type QuestionTransferRow,
} from "@mms/shared";
import { throwIfBackgroundJobAborted } from "../lib/backgroundJobAbort.js";
import { questionBankUseCases } from "../questionBank/use-cases/questionBankUseCases.js";

/** Rows written per transaction; keeps the write plan, invariants and audit batch bounded. */
const IMPORT_CHUNK_SIZE = 50;

export interface QuestionBankImportContext {
  tenant: string;
  userId: string;
  jobId: string;
  viewerRole: string;
  signal?: AbortSignal;
  updateProgress: (current: number, total: number) => Promise<void>;
}

export interface QuestionBankImportResult {
  imported: number;
  failed: number;
  total: number;
  errors: Array<{ row: number; reason: string }>;
}

/**
 * Deterministic question id for an imported row.
 *
 * The id depends only on (tenant, job, row index), so a retry, a stall recovery or an ops replay of
 * the same job upserts the same rows instead of inserting duplicates. A *new* job with the same
 * rows produces new ids — the route's content-hash idempotency key already prevents that path.
 */
export function questionImportId(tenant: string, jobId: string, rowIndex: number): string {
  const digest = createHash("sha256")
    .update(`${tenant.trim().toLowerCase()}:${jobId}:${rowIndex}`)
    .digest("hex")
    .slice(0, 20);
  return `q-imp-${digest}`;
}

/**
 * Maps, validates and upserts CSV rows as **drafts**.
 *
 * Invalid rows are reported and skipped rather than failing the batch. `status` on the transfer row
 * is ignored on purpose: an author holds `questionBank.write`, and honouring the column would let a
 * CSV import approve questions without `questionBank.delete`.
 */
export async function runQuestionBankImportJob(
  rows: QuestionTransferRow[],
  ctx: QuestionBankImportContext,
): Promise<QuestionBankImportResult> {
  const total = rows.length;
  const errors: QuestionBankImportResult["errors"] = [];
  const candidates: Array<{ index: number; value: QuestionImportCandidate }> = [];
  rows.forEach((row, index) => {
    const mapped = transferRowToQuestionInput(row);
    if (!mapped.ok) {
      errors.push({ row: index + 1, reason: mapped.reason });
      return;
    }
    candidates.push({ index, value: mapped.value });
  });

  let imported = 0;
  for (let offset = 0; offset < candidates.length; offset += IMPORT_CHUNK_SIZE) {
    throwIfBackgroundJobAborted(ctx.signal);
    const chunk = candidates.slice(offset, offset + IMPORT_CHUNK_SIZE);
    const records: QuestionBankQuestion[] = chunk.map(({ index, value }) => ({
      id: questionImportId(ctx.tenant, ctx.jobId, index),
      categoryIds: value.categoryIds,
      type: value.type,
      difficulty: value.difficulty,
      questionLanguage: value.questionLanguage,
      text: value.text,
      options: value.options,
      answer: value.answer,
      marks: value.marks,
      ...(value.sourceCitations.length > 0 ? { sourceCitations: value.sourceCitations } : {}),
      // Server-owned field, forced for every imported row.
      status: "draft",
    }));

    await questionBankUseCases.upsertQuestions(records);
    imported += records.length;
    await ctx.updateProgress(imported + errors.length, Math.max(total, 1));
  }

  return { imported, failed: errors.length, total, errors };
}

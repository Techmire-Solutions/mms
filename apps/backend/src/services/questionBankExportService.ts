import type { QuestionBankTransferEntity } from "@mms/shared";
import { buildCsvContent, questionBankTransferSchema, questionToTransferEntity } from "@mms/shared";
import { questionBankRepository } from "../questionBank/repository/questionBankRepositoryAdapter.js";
import { throwIfBackgroundJobAborted } from "../lib/backgroundJobAbort.js";

/** Rows per page read; `runListPage` caps the page size at 100. */
const EXPORT_PAGE_SIZE = 100;
/**
 * Hard ceiling for one export. The route caps the synchronous list at 500; a background export may
 * walk more, but the artifact is materialised in the sandboxed child, so it stays bounded.
 */
const MAX_EXPORT_ROWS = 5000;

/**
 * Builds the Question Bank CSV artifact.
 *
 * Columns come from the shared transfer schema, so the file is the exact mirror of the import
 * contract (export → edit → import round-trips). The route gates this job on `questionBank.delete`
 * because the file contains the answer key; the job re-checks module access on execution.
 */
export async function buildQuestionBankCsvExport(
  query: Record<string, unknown>,
  options: { filename?: string; allowDeleted?: boolean; viewerRole: string },
  tenant?: string,
  signal?: AbortSignal,
): Promise<{ csv: string; filename: string; count: number }> {
  const tenantId = tenant?.trim().toLowerCase();
  if (!tenantId) throw new Error("Question Bank export requires a tenant context");

  const includeDeleted = options.allowDeleted === true;
  const includeIds = Array.isArray(query.includeIds)
    ? new Set(query.includeIds.map((id) => String(id)))
    : null;

  const entities: QuestionBankTransferEntity[] = [];
  let page = 1;
  for (;;) {
    throwIfBackgroundJobAborted(signal);
    const result = await questionBankRepository.listQuestionsPage(tenantId, {
      page,
      limit: EXPORT_PAGE_SIZE,
      includeDeleted,
    });
    const questions = includeIds
      ? result.questions.filter((question) => includeIds.has(question.id))
      : result.questions;
    for (const question of questions) entities.push(questionToTransferEntity(question));
    if (!result.hasMore || entities.length >= MAX_EXPORT_ROWS) break;
    page += 1;
  }

  throwIfBackgroundJobAborted(signal);
  const rows = entities.slice(0, MAX_EXPORT_ROWS);
  return {
    csv: questionBankTransferSchema.toExportCsv(rows),
    filename: options.filename?.trim() || "question-bank.csv",
    count: rows.length,
  };
}

/**
 * Streamed export: header once, then one CSV chunk per page.
 *
 * The generic export runner streams these chunks to storage, so the sandboxed child never holds the
 * whole artifact (the buffered `buildExport` above remains for tests and small exports).
 */
export async function* generateQuestionBankCsvStreamChunks(
  query: Record<string, unknown>,
  options: { filename?: string; allowDeleted?: boolean; viewerRole: string },
  tenant?: string,
): AsyncGenerator<string, { count: number; filename: string }, undefined> {
  const tenantId = tenant?.trim().toLowerCase();
  if (!tenantId) throw new Error("Question Bank export requires a tenant context");

  const includeDeleted = options.allowDeleted === true;
  const includeIds = Array.isArray(query.includeIds)
    ? new Set(query.includeIds.map((id) => String(id)))
    : null;
  const filename = options.filename?.trim() || "question-bank.csv";

  yield buildCsvContent(questionBankTransferSchema.buildGrid([]));

  let count = 0;
  let page = 1;
  for (;;) {
    const result = await questionBankRepository.listQuestionsPage(tenantId, {
      page,
      limit: EXPORT_PAGE_SIZE,
      includeDeleted,
    });
    const questions = includeIds
      ? result.questions.filter((question) => includeIds.has(question.id))
      : result.questions;
    if (questions.length > 0) {
      const rows = questions.map(questionToTransferEntity);
      const grid = questionBankTransferSchema.buildGrid(rows).slice(1);
      yield `\n${buildCsvContent(grid)}`;
      count += rows.length;
    }
    if (!result.hasMore || count >= MAX_EXPORT_ROWS) break;
    page += 1;
  }

  return { count, filename };
}

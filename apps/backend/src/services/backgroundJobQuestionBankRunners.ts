import { QUESTION_BANK_MODULE_MANIFEST, type QuestionTransferRow } from "@mms/shared";
import { registerModuleCsvExportJobRunner } from "../lib/registerModuleCsvExportJobRunner.js";
import { registerModuleCsvImportJobRunner } from "../lib/registerModuleCsvImportJobRunner.js";
import {
  buildQuestionBankCsvExport,
  generateQuestionBankCsvStreamChunks,
} from "./questionBankExportService.js";
import { runQuestionBankImportJob } from "./questionBankImportJobService.js";

/**
 * Question Bank background-job runners.
 *
 * Registered in the shared worker/API registry so `hasBackgroundJobRunner` flips the routes from
 * 503 to a queued 202. Both jobs re-check module access at execution time
 * (`backgroundJobModuleAction`: import → write, export → export → `questionBank.delete`).
 */
export function registerQuestionBankBackgroundJobRunners(): void {
  const moduleId = QUESTION_BANK_MODULE_MANIFEST.moduleId;

  registerModuleCsvExportJobRunner({
    moduleId,
    entityNounPlural: "questions",
    buildExport: buildQuestionBankCsvExport,
    generateStreamChunks: generateQuestionBankCsvStreamChunks,
  });

  registerModuleCsvImportJobRunner<QuestionTransferRow>({
    moduleId,
    entityNounPlural: "questions",
    importBatch: (rows, ctx) =>
      runQuestionBankImportJob(rows, {
        tenant: ctx.tenant,
        userId: ctx.userId,
        jobId: ctx.jobId,
        viewerRole: ctx.viewerRole,
        signal: ctx.signal,
        updateProgress: ctx.updateProgress,
      }),
  });
}

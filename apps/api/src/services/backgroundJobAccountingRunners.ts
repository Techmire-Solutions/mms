import { buildAccountingReportDocument } from "@mms/mod-accounting/backend/use-cases";
import { registerModuleCsvImportJobRunner } from "../lib/registerModuleCsvImportJobRunner.js";
import { registerModuleCsvExportJobRunner } from "../lib/registerModuleCsvExportJobRunner.js";
import { registerBackgroundJobRunner } from "./backgroundJobWorkerService.js";
import { saveStreamedExportArtifact } from "./exportArtifactService.js";
import { configureAccountingRunnerDeps } from "@mms/mod-accounting/backend/jobs";
import {
  importAccountingAccounts,
  registerAccountingBackgroundJobRunners,
} from "@mms/mod-accounting/backend/jobs";

configureAccountingRunnerDeps({
  registerCsvImportJobRunner: (options) => registerModuleCsvImportJobRunner(options as never),
  registerCsvExportJobRunner: (options) => registerModuleCsvExportJobRunner(options as never),
  registerBackgroundJobRunner: (kind, handler) =>
    registerBackgroundJobRunner(kind, handler as never),
  buildReportDocument: (body) => buildAccountingReportDocument(body as never),
  processPdfRenderJob: async (tenant, document, progress, signal) => {
    const { processPdfRenderJob } = await import("../worker/processors/pdf-rendering.js");
    return processPdfRenderJob(tenant, document as never, progress, signal);
  },
  saveArtifact: (userId, jobId, artifact) =>
    saveStreamedExportArtifact(userId, jobId, {
      ...artifact,
      storageType: artifact.storageType as "local" | "s3",
    }),
});

export { importAccountingAccounts, registerAccountingBackgroundJobRunners };

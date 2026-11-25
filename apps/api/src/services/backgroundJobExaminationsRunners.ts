import { registerModuleCsvExportJobRunner } from "../lib/registerModuleCsvExportJobRunner.js";
import { buildExaminationsCsvExport } from "@mms/mod-examinations/backend/services";
import { registerExaminationsImportJobRunner } from "@mms/mod-examinations/backend/services";
import { registerExaminationsMarksImportJobRunner } from "@mms/mod-examinations/backend/services";
import { registerExaminationsResultsExportJobRunner } from "./examinationsResultsExportService.js";

/**
 * Registers the `examinations:export` / `examinations:import` job runners.
 *
 * Both routes already existed and gate on `hasBackgroundJobRunner`, so without these registrations
 * every export and import request answered 503. Registered from the shared default-runner registry
 * so the API (which answers the 503 probe) and the worker (which executes the job) agree.
 */
export function registerExaminationsJobRunners(): void {
  registerModuleCsvExportJobRunner({
    moduleId: "examinations",
    entityNounPlural: "exams",
    buildExport: (query, options) =>
      buildExaminationsCsvExport(query, {
        columns: options.columns,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted,
      }),
  });
  registerExaminationsImportJobRunner();
  registerExaminationsMarksImportJobRunner();
  registerExaminationsResultsExportJobRunner();
}

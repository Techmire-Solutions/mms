/**
 * @file backgroundJobTasksRunners.ts
 * @description Queued CSV export/import runners for the Tasks module.
 *
 * Tasks shipped its transfer routes with no `tasks:export` / `tasks:import`
 * runner, so every queued transfer failed with "No runner registered".
 */
import { TASKS_MODULE_MANIFEST, type TasksImportBody } from "@mms/shared";
import { registerModuleCsvExportJobRunner } from "../lib/registerModuleCsvExportJobRunner.js";
import { registerModuleCsvImportJobRunner } from "../lib/registerModuleCsvImportJobRunner.js";
import { buildTasksCsvExport, generateTasksCsvStreamChunks } from "./tasksExportService.js";
import { runTasksImportJob } from "../tasks/use-cases/taskImportUseCases.js";

export function registerTasksBackgroundJobRunners(): void {
  const moduleId = TASKS_MODULE_MANIFEST.moduleId;

  registerModuleCsvExportJobRunner({
    moduleId,
    entityNounPlural: "tasks",
    buildExport: (query, options) => buildTasksCsvExport(query, options),
    generateStreamChunks: (query, options) => generateTasksCsvStreamChunks(query, options),
  });

  registerModuleCsvImportJobRunner<TasksImportBody["rows"][number]>({
    moduleId,
    entityNounPlural: "tasks",
    importBatch: (rows, ctx) =>
      runTasksImportJob(rows, {
        tenant: ctx.tenant,
        userId: ctx.userId,
        viewerRole: ctx.viewerRole,
        updateProgress: ctx.updateProgress,
      }),
  });
}

/**
 * @file backgroundJobTasksRunners.ts
 * @description Queued CSV export/import runners for the Tasks module.
 *
 * Tasks shipped its transfer routes with no `tasks:export` / `tasks:import`
 * runner, so every queued transfer failed with "No runner registered".
 */
import { TASKS_MODULE_MANIFEST, type TasksImportBody } from "@mms/contracts";
import { registerModuleCsvExportJobRunner } from "../deps.js";
import { registerModuleCsvImportJobRunner } from "@mms/be-core/jobs";
import {
  buildTasksCsvExport,
  generateTasksCsvStreamChunks,
} from "../services/tasksExportService.js";
import { runTasksImportJob } from "../use-cases/taskImportUseCases.js";

export function registerTasksBackgroundJobRunners(): void {
  const moduleId = TASKS_MODULE_MANIFEST.moduleId;

  registerModuleCsvExportJobRunner({
    moduleId,
    entityNounPlural: "tasks",
    buildExport: (query: any, options: any) => buildTasksCsvExport(query, options),
    generateStreamChunks: (query: any, options: any) =>
      generateTasksCsvStreamChunks(query, options),
  });

  registerModuleCsvImportJobRunner<TasksImportBody["rows"][number]>({
    moduleId,
    entityNounPlural: "tasks",
    importBatch: (rows, ctx) =>
      runTasksImportJob(rows, {
        tenant: ctx.tenant,
        userId: ctx.userId,
        updateProgress: ctx.updateProgress,
      }),
  });
}

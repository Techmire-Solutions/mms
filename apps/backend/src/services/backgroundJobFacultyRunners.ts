import {
  FACULTY_MODULE_MANIFEST,
  type FacultyExportColumn,
  type FacultyImportJobPayload,
} from "@mms/shared";
import type { FacultyExportQueryInput } from "./facultyExportService.js";
import { buildFacultyCsvExport, generateFacultyCsvStreamChunks } from "./facultyExportService.js";
import {
  buildFacultyImportJobLabel,
  runFacultyMembersImportJob,
} from "../faculty/use-cases/facultyImportJobUseCases.js";
import {
  buildCatalogImportJobLabel,
  runFacultyDepartmentsImportJob,
  runFacultyDesignationsImportJob,
} from "../faculty/use-cases/facultyCatalogImportJobUseCases.js";
import {
  buildFacultyDepartmentsCsvExport,
  buildFacultyDesignationsCsvExport,
} from "./facultyCatalogExportService.js";
import { registerBackgroundJobRunner } from "./backgroundJobWorkerService.js";
import { registerModuleCsvExportJobRunner } from "../lib/registerModuleCsvExportJobRunner.js";

export function registerFacultyBackgroundJobRunners(): void {
  const facultyModuleId = FACULTY_MODULE_MANIFEST.moduleId;

  registerModuleCsvExportJobRunner({
    moduleId: facultyModuleId,
    entityNounPlural: "faculty",
    buildExport: (query, options) =>
      buildFacultyCsvExport(query as FacultyExportQueryInput, {
        columns: options.columns as FacultyExportColumn[] | undefined,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted,
      }),
    generateStreamChunks: (query, options) =>
      generateFacultyCsvStreamChunks(query as FacultyExportQueryInput, {
        columns: options.columns as FacultyExportColumn[] | undefined,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted === true,
      }),
  });

  registerBackgroundJobRunner(`${facultyModuleId}:import`, async (payload, ctx) => {
    const result = await runFacultyMembersImportJob(payload as FacultyImportJobPayload, {
      tenant: ctx.tenant,
      userId: ctx.userId,
      updateProgress: (current, total) => ctx.updateProgress(current, total),
    });
    await ctx.complete({
      label: buildFacultyImportJobLabel(result),
      progress: { current: result.imported, total: Math.max(result.total, 1) },
    });
  });

  registerModuleCsvExportJobRunner({
    moduleId: "faculty-departments",
    entityNounPlural: "departments",
    buildExport: (query, options, tenant) =>
      buildFacultyDepartmentsCsvExport(query, { filename: options.filename }, tenant),
  });

  registerBackgroundJobRunner("faculty-departments:import", async (payload, ctx) => {
    const result = await runFacultyDepartmentsImportJob(
      payload as { rows: Parameters<typeof runFacultyDepartmentsImportJob>[0]["rows"] },
      {
        tenant: ctx.tenant,
        userId: ctx.userId,
        updateProgress: (current, total) => ctx.updateProgress(current, total),
      },
    );
    await ctx.complete({
      label: buildCatalogImportJobLabel("departments", result),
      progress: { current: result.imported, total: Math.max(result.total, 1) },
    });
  });

  registerModuleCsvExportJobRunner({
    moduleId: "faculty-designations",
    entityNounPlural: "designations",
    buildExport: (query, options, tenant) =>
      buildFacultyDesignationsCsvExport(query, { filename: options.filename }, tenant),
  });

  registerBackgroundJobRunner("faculty-designations:import", async (payload, ctx) => {
    const result = await runFacultyDesignationsImportJob(
      payload as { rows: Parameters<typeof runFacultyDesignationsImportJob>[0]["rows"] },
      {
        tenant: ctx.tenant,
        userId: ctx.userId,
        updateProgress: (current, total) => ctx.updateProgress(current, total),
      },
    );
    await ctx.complete({
      label: buildCatalogImportJobLabel("designations", result),
      progress: { current: result.imported, total: Math.max(result.total, 1) },
    });
  });
}

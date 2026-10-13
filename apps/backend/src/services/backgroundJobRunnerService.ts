import {
  buildTenantExportFilename,
  CONTACTS_MODULE_MANIFEST,
  ENROLLMENTS_MODULE_MANIFEST,
  MESSAGING_MODULE_MANIFEST,
  SESSIONS_MODULE_MANIFEST,
  STUDENTS_MODULE_MANIFEST,
  FACULTY_MODULE_MANIFEST,
  USERS_MODULE_MANIFEST,
} from "@mms/shared";
import type {
  ContactExportColumn,
  ContactsImportJobPayload,
  EnrollmentExportColumn,
  MessagingCsvExportQueryDto,
  SessionExportColumn,
  StudentExportColumn,
  FacultyExportColumn,
} from "@mms/shared";
import type { ContactsExportQueryInput } from "../contacts/use-cases/contactExportUseCases.js";
import {
  buildContactsCsvExport,
  generateContactsCsvStreamChunks,
} from "../contacts/use-cases/contactExportUseCases.js";
import { buildContactsVcfExport } from "./contactsVcfExportService.js";
import type { StudentsExportQueryInput } from "./studentsExportService.js";
import {
  buildStudentsCsvExport,
  generateStudentsCsvStreamChunks,
} from "./studentsExportService.js";
import type { FacultyExportQueryInput } from "./facultyExportService.js";
import { buildFacultyCsvExport, generateFacultyCsvStreamChunks } from "./facultyExportService.js";
import type { SessionsExportQueryInput } from "./sessionsExportService.js";
import {
  buildSessionsCsvExport,
  generateSessionsCsvStreamChunks,
} from "./sessionsExportService.js";
import type { EnrollmentsExportQueryInput } from "./enrollmentsExportService.js";
import {
  buildEnrollmentsCsvExport,
  generateEnrollmentsCsvStreamChunks,
} from "./enrollmentsExportService.js";
import type { UsersExportQueryInput } from "./usersExportService.js";
import { buildUsersCsvExport, generateUsersCsvStreamChunks } from "./usersExportService.js";

/** Cap on ledger entries carried in the `finance:export-excel` job payload. */
const MAX_EXCEL_PAYLOAD_ENTRIES = 50_000;
import {
  buildMessagingCsvExport,
  generateMessagingCsvStreamChunks,
} from "./messagingExportService.js";
import { saveExportArtifact, saveStreamedExportArtifact } from "./exportArtifactService.js";
import { runContactsDuplicateScan } from "../contacts/use-cases/contactDuplicateScanUseCases.js";
import {
  buildContactsImportJobLabel,
  runContactsImportJob,
} from "../contacts/use-cases/contactImportJobUseCases.js";
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
import type { FacultyImportJobPayload } from "@mms/shared";

export interface ContactsExportJobPayload {
  query?: ContactsExportQueryInput;
  columns?: ContactExportColumn[];
  filename?: string;
  label?: string;
  viewerRole: string;
  /** Enqueue-time privilege — runner must not honor includeDeleted without this. */
  allowDeleted?: boolean;
}

export interface ContactsVcfExportJobPayload {
  filename?: string;
  label?: string;
}

export interface StudentsExportJobPayload {
  query?: StudentsExportQueryInput;
  columns?: StudentExportColumn[];
  filename?: string;
  label?: string;
  viewerRole: string;
  allowDeleted?: boolean;
}

export interface SessionsExportJobPayload {
  query?: SessionsExportQueryInput;
  columns?: SessionExportColumn[];
  filename?: string;
  label?: string;
  viewerRole: string;
  allowDeleted?: boolean;
}

export interface FacultyExportJobPayload {
  query?: FacultyExportQueryInput;
  columns?: FacultyExportColumn[];
  filename?: string;
  label?: string;
  viewerRole: string;
  allowDeleted?: boolean;
}

export interface EnrollmentsExportJobPayload {
  query?: EnrollmentsExportQueryInput;
  columns?: EnrollmentExportColumn[];
  filename?: string;
  label?: string;
  viewerRole: string;
  allowDeleted?: boolean;
}

export interface MessagingExportJobPayload {
  query?: MessagingCsvExportQueryDto;
  filename?: string;
  label?: string;
}

export function registerDefaultBackgroundJobRunners(): void {
  const contactsModuleId = CONTACTS_MODULE_MANIFEST.moduleId;
  const messagingModuleId = MESSAGING_MODULE_MANIFEST.moduleId;
  const studentsModuleId = STUDENTS_MODULE_MANIFEST.moduleId;
  const facultyModuleId = FACULTY_MODULE_MANIFEST.moduleId;
  const sessionsModuleId = SESSIONS_MODULE_MANIFEST.moduleId;

  registerModuleCsvExportJobRunner({
    moduleId: contactsModuleId,
    entityNounPlural: "contacts",
    buildExport: (query, options) =>
      buildContactsCsvExport(query as ContactsExportQueryInput, {
        columns: options.columns as ContactExportColumn[] | undefined,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted,
      }),
    generateStreamChunks: (query, options) =>
      generateContactsCsvStreamChunks(query as ContactsExportQueryInput, {
        columns: options.columns as ContactExportColumn[] | undefined,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted === true,
      }),
  });

  registerBackgroundJobRunner(`${contactsModuleId}:export-vcf`, async (payload, ctx) => {
    const exportPayload = payload as ContactsVcfExportJobPayload;
    await ctx.updateProgress(0, 1);
    const targetFilename = buildTenantExportFilename(
      ctx.tenant,
      exportPayload.filename?.trim() || "contacts.vcf",
    );
    const { vcf, filename, count } = await buildContactsVcfExport({
      filename: targetFilename,
      onProgress: (processed, total) => ctx.updateProgress(processed, Math.max(total, 1)),
    });
    await saveExportArtifact(ctx.userId, ctx.jobId, vcf, filename);
    await ctx.complete({
      label: exportPayload.label ?? `Exported ${count} contacts`,
      progress: { current: count, total: count },
      hasDownload: true,
    });
  });

  registerBackgroundJobRunner(`${contactsModuleId}:duplicate-scan`, async (_payload, ctx) => {
    const result = await runContactsDuplicateScan(async (processed, total) => {
      await ctx.updateProgress(processed, total);
    });
    await ctx.complete({
      label: `Found ${result.pairCount} duplicate pairs`,
      progress: { current: result.pairCount, total: Math.max(result.pairCount, 1) },
    });
  });

  registerBackgroundJobRunner(`${contactsModuleId}:import`, async (payload, ctx) => {
    const result = await runContactsImportJob(payload as ContactsImportJobPayload, {
      tenant: ctx.tenant,
      userId: ctx.userId,
      jobId: ctx.jobId,
      updateProgress: (current, total) => ctx.updateProgress(current, total),
    });
    await ctx.complete({
      label: buildContactsImportJobLabel(result),
      // `current` = imported, `total` = received, so the client can derive the failure count.
      progress: { current: result.imported, total: Math.max(result.total, 1) },
    });
  });

  registerModuleCsvExportJobRunner({
    moduleId: studentsModuleId,
    entityNounPlural: "students",
    buildExport: (query, options) =>
      buildStudentsCsvExport(query as StudentsExportQueryInput, {
        columns: options.columns as StudentExportColumn[] | undefined,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted,
      }),
    generateStreamChunks: (query, options) =>
      generateStudentsCsvStreamChunks(query as StudentsExportQueryInput, {
        columns: options.columns as StudentExportColumn[] | undefined,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted === true,
      }),
  });

  registerModuleCsvExportJobRunner({
    moduleId: sessionsModuleId,
    entityNounPlural: "sessions",
    buildExport: (query, options) =>
      buildSessionsCsvExport(query as SessionsExportQueryInput, {
        columns: options.columns as SessionExportColumn[] | undefined,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted,
      }),
    generateStreamChunks: (query, options) =>
      generateSessionsCsvStreamChunks(query as SessionsExportQueryInput, {
        columns: options.columns as SessionExportColumn[] | undefined,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted === true,
      }),
  });

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

  registerModuleCsvExportJobRunner({
    moduleId: ENROLLMENTS_MODULE_MANIFEST.moduleId,
    entityNounPlural: "enrollments",
    buildExport: (query, options) =>
      buildEnrollmentsCsvExport(query as EnrollmentsExportQueryInput, {
        columns: options.columns as EnrollmentExportColumn[] | undefined,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted,
      }),
    generateStreamChunks: (query, options) =>
      generateEnrollmentsCsvStreamChunks(query as EnrollmentsExportQueryInput, {
        columns: options.columns as EnrollmentExportColumn[] | undefined,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted === true,
      }),
  });

  registerModuleCsvExportJobRunner({
    moduleId: USERS_MODULE_MANIFEST.moduleId,
    entityNounPlural: "users",
    buildExport: (query, options) =>
      buildUsersCsvExport(query as UsersExportQueryInput, {
        columns: options.columns as import("@mms/shared").UserExportColumn[] | undefined,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted,
      }),
    generateStreamChunks: (query, options) =>
      generateUsersCsvStreamChunks(query as UsersExportQueryInput, {
        columns: options.columns as import("@mms/shared").UserExportColumn[] | undefined,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted === true,
      }),
  });

  registerModuleCsvExportJobRunner({
    moduleId: messagingModuleId,
    entityNounPlural: "message logs",
    buildExport: (query, options, tenant) =>
      buildMessagingCsvExport(tenant || "", query as MessagingCsvExportQueryDto, {
        filename: options.filename,
      }),
    generateStreamChunks: (query, options, tenant) =>
      generateMessagingCsvStreamChunks(tenant || "", query as MessagingCsvExportQueryDto, {
        filename: options.filename,
      }),
  });

  // Phase 6: Headless BiDi Document Engine & Streaming Excel exports
  registerBackgroundJobRunner("students:render-report-card", async (payload, ctx) => {
    const { processPdfRenderJob } = await import("../worker/processors/pdf-rendering.js");
    await ctx.updateProgress(10, 100);
    const data = (payload as { data: Record<string, unknown>; filename?: string }).data || {};
    const filename = (payload as { filename?: string }).filename || "report-card.pdf";
    const result = await processPdfRenderJob(
      ctx.tenant,
      {
        template: "report-card",
        data,
        filename,
      },
      async (pct) => ctx.updateProgress(pct, 100),
    );
    await saveStreamedExportArtifact(ctx.userId, ctx.jobId, {
      key: result.key,
      storageType: result.storageType,
      filename,
      contentType: "application/pdf",
    });
    await ctx.complete({
      label: `Generated Report Card (${result.key})`,
      progress: { current: 100, total: 100 },
      hasDownload: true,
    });
  });

  registerBackgroundJobRunner("finance:render-receipt", async (payload, ctx) => {
    const { processPdfRenderJob } = await import("../worker/processors/pdf-rendering.js");
    await ctx.updateProgress(10, 100);
    const data = (payload as { data: Record<string, unknown>; filename?: string }).data || {};
    const filename = (payload as { filename?: string }).filename || "fee-receipt.pdf";
    const result = await processPdfRenderJob(
      ctx.tenant,
      {
        template: "fee-receipt",
        data,
        filename,
      },
      async (pct) => ctx.updateProgress(pct, 100),
    );
    await saveStreamedExportArtifact(ctx.userId, ctx.jobId, {
      key: result.key,
      storageType: result.storageType,
      filename,
      contentType: "application/pdf",
    });
    await ctx.complete({
      label: `Generated Fee Receipt (${result.key})`,
      progress: { current: 100, total: 100 },
      hasDownload: true,
    });
  });

  registerBackgroundJobRunner("finance:render-ledger", async (payload, ctx) => {
    const { processPdfRenderJob } = await import("../worker/processors/pdf-rendering.js");
    await ctx.updateProgress(10, 100);
    const data = (payload as { data: Record<string, unknown>; filename?: string }).data || {};
    const filename = (payload as { filename?: string }).filename || "financial-ledger.pdf";
    const result = await processPdfRenderJob(
      ctx.tenant,
      {
        template: "financial-ledger",
        data,
        filename,
      },
      async (pct) => ctx.updateProgress(pct, 100),
    );
    await saveStreamedExportArtifact(ctx.userId, ctx.jobId, {
      key: result.key,
      storageType: result.storageType,
      filename,
      contentType: "application/pdf",
    });
    await ctx.complete({
      label: `Generated Financial Ledger (${result.key})`,
      progress: { current: 100, total: 100 },
      hasDownload: true,
    });
  });

  registerBackgroundJobRunner("finance:collect", async (_payload, ctx) => {
    const { collectOverdueInvoices } =
      await import("../finance/use-cases/financeCollectUseCases.js");
    await ctx.updateProgress(0, 1);
    const result = await collectOverdueInvoices({ applyLateFee: true });
    await ctx.complete({
      label: `Marked ${result.markedOverdue} overdue; applied ${result.lateFeesApplied} late fees`,
      progress: { current: 1, total: 1 },
    });
  });

  registerBackgroundJobRunner("finance:export-excel", async (payload, ctx) => {
    const { streamTableToExcel } = await import("../worker/processors/excel-export.js");
    const { filename = "ledger-export.xlsx", entries = [] } = payload as {
      filename?: string;
      entries?: Record<string, unknown>[];
    };

    // Guard against unbounded payloads being carried in the job data / DB row.
    if (entries.length > MAX_EXCEL_PAYLOAD_ENTRIES) {
      throw new Error(
        `Ledger export exceeds maximum of ${MAX_EXCEL_PAYLOAD_ENTRIES} entries carried in the job payload.`,
      );
    }

    async function* generateRows() {
      for (const entry of entries) {
        yield entry;
      }
    }

    await ctx.updateProgress(10, 100);
    const result = await streamTableToExcel({
      tenantId: ctx.tenant,
      filename,
      worksheetName: "Ledger",
      columns: [
        { header: "Date", key: "date", width: 15 },
        { header: "Account", key: "account", width: 25 },
        { header: "Debit", key: "debit", width: 15 },
        { header: "Credit", key: "credit", width: 15 },
        { header: "Balance", key: "balance", width: 15 },
        { header: "Description", key: "description", width: 35 },
      ],
      rowGenerator: generateRows(),
    });
    await saveStreamedExportArtifact(ctx.userId, ctx.jobId, {
      key: result.key,
      storageType: result.storageType,
      filename,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await ctx.complete({
      label: `Streamed Ledger to Excel (${result.key})`,
      progress: { current: 100, total: 100 },
      hasDownload: true,
    });
  });
}

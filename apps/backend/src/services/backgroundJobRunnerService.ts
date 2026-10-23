import { randomUUID } from "node:crypto";
import {
  buildTenantExportFilename,
  CONTACTS_MODULE_MANIFEST,
  ENROLLMENTS_MODULE_MANIFEST,
  MESSAGING_MODULE_MANIFEST,
  SESSIONS_MODULE_MANIFEST,
  STUDENTS_MODULE_MANIFEST,
  USERS_MODULE_MANIFEST,
} from "@mms/shared";
import type {
  ContactExportColumn,
  ContactsImportJobPayload,
  EnrollmentExportColumn,
  MessagingCsvExportQueryDto,
  SessionExportColumn,
  StudentExportColumn,
  UserExportColumn,
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
import {
  buildMessagingCsvExport,
  generateMessagingCsvStreamChunks,
} from "./messagingExportService.js";
import { saveExportArtifact } from "./exportArtifactService.js";
import { runContactsDuplicateScan } from "../contacts/use-cases/contactDuplicateScanUseCases.js";
import {
  buildContactsImportJobLabel,
  runContactsImportJob,
} from "../contacts/use-cases/contactImportJobUseCases.js";
import { registerBackgroundJobRunner } from "./backgroundJobWorkerService.js";
import { registerSessionRolloverJobRunner } from "../sessions/use-cases/sessionRolloverJob.js";
import { registerModuleCsvExportJobRunner } from "../lib/registerModuleCsvExportJobRunner.js";
import { registerModuleCsvImportJobRunner } from "../lib/registerModuleCsvImportJobRunner.js";
import { messagingUseCases } from "../messaging/use-cases/messagingUseCases.js";
import { registerMessagingCampaignJobRunner } from "./messagingCampaignJobRunner.js";
import { registerFacultyBackgroundJobRunners } from "./backgroundJobFacultyRunners.js";
import {
  registerDocumentAndFinanceJobRunners,
  MAX_EXCEL_PAYLOAD_ENTRIES,
} from "./backgroundJobDocumentFinanceRunners.js";
import type { ContactsVcfExportJobPayload } from "./backgroundJobPayloads.js";

export { MAX_EXCEL_PAYLOAD_ENTRIES };
export type {
  ContactsExportJobPayload,
  ContactsVcfExportJobPayload,
  StudentsExportJobPayload,
  SessionsExportJobPayload,
  FacultyExportJobPayload,
  EnrollmentsExportJobPayload,
  MessagingExportJobPayload,
} from "./backgroundJobPayloads.js";

export function registerDefaultBackgroundJobRunners(): void {
  const contactsModuleId = CONTACTS_MODULE_MANIFEST.moduleId;
  const messagingModuleId = MESSAGING_MODULE_MANIFEST.moduleId;
  const studentsModuleId = STUDENTS_MODULE_MANIFEST.moduleId;
  const sessionsModuleId = SESSIONS_MODULE_MANIFEST.moduleId;
  registerSessionRolloverJobRunner();

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

  // Modular faculty and catalog export/import runners
  registerFacultyBackgroundJobRunners();

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
        columns: options.columns as UserExportColumn[] | undefined,
        filename: options.filename,
        viewerRole: options.viewerRole,
        allowDeleted: options.allowDeleted,
      }),
    generateStreamChunks: (query, options) =>
      generateUsersCsvStreamChunks(query as UsersExportQueryInput, {
        columns: options.columns as UserExportColumn[] | undefined,
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

  registerModuleCsvImportJobRunner<{
    title?: string;
    message?: string;
    channel?: string;
    notes?: string;
  }>({
    moduleId: messagingModuleId,
    entityNounPlural: "templates",
    importBatch: async (rows, ctx) => {
      let imported = 0;
      let failed = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const title = row.title?.trim();
        const body = row.message?.trim();
        if (!title || !body) {
          failed++;
          continue;
        }
        const channel = (
          ["sms", "whatsapp", "email", "all"].includes(row.channel?.toLowerCase() || "")
            ? row.channel?.toLowerCase()
            : "all"
        ) as "sms" | "whatsapp" | "email" | "all";
        const category = (
          ["general", "academic", "financial", "attendance", "emergency"].includes(
            row.notes?.toLowerCase() || "",
          )
            ? row.notes?.toLowerCase()
            : "general"
        ) as "general" | "academic" | "financial" | "attendance" | "emergency";

        try {
          await messagingUseCases.saveMessageTemplate(ctx.tenant, {
            id: `custom_${randomUUID()}`,
            label: title,
            body,
            channel,
            category,
            updatedAt: new Date().toISOString(),
          });
          imported++;
        } catch {
          failed++;
        }
        if ((i + 1) % 10 === 0) {
          await ctx.updateProgress(i + 1, rows.length);
        }
      }
      return { imported, failed, total: rows.length };
    },
  });

  // Headless BiDi Document Engine & Streaming Excel exports
  registerDocumentAndFinanceJobRunners();

  // Multi-channel campaign dispatch worker
  registerMessagingCampaignJobRunner();
}

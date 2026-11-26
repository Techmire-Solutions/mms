import { registerAttendanceJobRunners } from "@mms/mod-attendance/backend/jobs";
import { registerExaminationsJobRunners } from "./backgroundJobExaminationsRunners.js";
import { registerHasanatJobRunners } from "@mms/mod-hasanat/backend/jobs";
import { registerObligationsJobRunners } from "./backgroundJobObligationsRunners.js";
import {
  CONTACTS_MODULE_MANIFEST,
  ENROLLMENTS_MODULE_MANIFEST,
  MESSAGING_MODULE_MANIFEST,
  SESSIONS_MODULE_MANIFEST,
  STUDENTS_MODULE_MANIFEST,
  USERS_MODULE_MANIFEST,
} from "@mms/contracts";
import type {
  ContactExportColumn,
  ContactsImportJobPayload,
  EnrollmentExportColumn,
  MessagingCsvExportQueryDto,
  SessionExportColumn,
  StudentExportColumn,
  UserExportColumn,
} from "@mms/contracts";
import type { ContactsExportQueryInput } from "@mms/mod-contacts/backend/use-cases";
import {
  buildContactsCsvExport,
  generateContactsCsvStreamChunks,
} from "@mms/mod-contacts/backend/use-cases";
import type { StudentsExportQueryInput } from "@mms/mod-students/backend/services";
import {
  buildStudentsCsvExport,
  generateStudentsCsvStreamChunks,
} from "@mms/mod-students/backend/services";
import { registerWorkshopsExportJobRunner } from "./backgroundJobWorkshopsRunners.js";
import { registerFinanceJobRunners } from "@mms/mod-billing/backend/jobs";
import type { SessionsExportQueryInput } from "@mms/mod-sessions/backend/services";
import {
  buildSessionsCsvExport,
  generateSessionsCsvStreamChunks,
} from "@mms/mod-sessions/backend/services";
import type { EnrollmentsExportQueryInput } from "@mms/mod-enrollments/backend/services";
import {
  buildEnrollmentsCsvExport,
  generateEnrollmentsCsvStreamChunks,
} from "@mms/mod-enrollments/backend/services";
import type { UsersExportQueryInput } from "./usersExportService.js";
import { buildUsersCsvExport, generateUsersCsvStreamChunks } from "./usersExportService.js";
import {
  buildMessagingCsvExport,
  generateMessagingCsvStreamChunks,
} from "@mms/mod-messaging/backend/services";
import { runContactsDuplicateScan } from "@mms/mod-contacts/backend/use-cases";
import {
  buildContactsImportJobLabel,
  runContactsImportJob,
} from "@mms/mod-contacts/backend/use-cases";
import { registerBackgroundJobRunner } from "./backgroundJobWorkerService.js";
import { registerSessionRolloverJobRunner } from "@mms/mod-sessions/backend/use-cases";
import { registerEnrollmentsImportJobRunner } from "@mms/mod-enrollments/backend/services";
import { registerSessionImportJobRunner } from "@mms/mod-sessions/backend/use-cases";
import { registerSessionsBulkJobRunners } from "@mms/mod-sessions/backend/jobs";
import { registerModuleCsvExportJobRunner } from "../lib/registerModuleCsvExportJobRunner.js";
import { registerContactsVcfExportJobRunner } from "@mms/mod-contacts/backend/jobs";
import { registerMessagingCampaignJobRunner } from "@mms/mod-messaging/backend/services";
import { registerMessagingImportJobRunner } from "@mms/mod-messaging/backend/jobs";
import { registerFacultyBackgroundJobRunners } from "@mms/mod-faculty/backend/jobs";
import { registerTasksBackgroundJobRunners } from "@mms/mod-tasks/backend/jobs";
import { registerQuestionBankBackgroundJobRunners } from "./backgroundJobQuestionBankRunners.js";
import { registerWorkshopImportJobRunner } from "@mms/mod-workshops/backend/jobs";
import { registerStudentsImportJobRunner } from "@mms/mod-students/backend/services";
import { registerUsersImportJobRunner } from "./backgroundJobUsersRunners.js";
import { registerDocumentAndFinanceJobRunners } from "./backgroundJobDocumentFinanceRunners.js";
import { registerAccountingBackgroundJobRunners } from "./backgroundJobAccountingRunners.js";
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
  registerExaminationsJobRunners();
  const contactsModuleId = CONTACTS_MODULE_MANIFEST.moduleId;
  const messagingModuleId = MESSAGING_MODULE_MANIFEST.moduleId;
  const studentsModuleId = STUDENTS_MODULE_MANIFEST.moduleId;
  const sessionsModuleId = SESSIONS_MODULE_MANIFEST.moduleId;
  registerAttendanceJobRunners();
  // Hasanat/obligations jobs run in the worker, so the shared registry registers them here.
  registerHasanatJobRunners();
  registerObligationsJobRunners();
  registerSessionRolloverJobRunner();
  registerSessionImportJobRunner();
  registerSessionsBulkJobRunners();
  registerEnrollmentsImportJobRunner();
  registerWorkshopImportJobRunner();
  registerWorkshopsExportJobRunner();
  registerFinanceJobRunners();
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

  registerContactsVcfExportJobRunner();
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

  registerStudentsImportJobRunner();
  registerUsersImportJobRunner();

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
  registerTasksBackgroundJobRunners();
  registerQuestionBankBackgroundJobRunners();
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
        viewerRole: options.viewerRole,
      }),
    generateStreamChunks: (query, options, tenant) =>
      generateMessagingCsvStreamChunks(tenant || "", query as MessagingCsvExportQueryDto, {
        filename: options.filename,
        viewerRole: options.viewerRole,
      }),
  });

  registerMessagingImportJobRunner();

  // Headless BiDi Document Engine & Streaming Excel exports
  registerDocumentAndFinanceJobRunners();
  // Accounting has no journal-entry CSV import (a flat file cannot be a balanced
  // voucher); the chart-of-accounts import is the module's queued transfer path.
  registerAccountingBackgroundJobRunners();

  // Multi-channel campaign dispatch worker
  registerMessagingCampaignJobRunner();
}

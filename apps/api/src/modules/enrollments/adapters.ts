/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Composition adapter for the enrollments module.
 *
 * Binds the module's kernel ports to the sessions/students/contacts/notifications/
 * billing modules, app attendance/workspace services and background-job plumbing.
 */
import { configureEnrollmentsPorts } from "@mms/mod-enrollments/backend/deps";
import * as sessions from "@mms/mod-sessions/backend/repository";
import * as sessionsUseCases from "@mms/mod-sessions/backend/use-cases";
import * as students from "@mms/mod-students/backend/repository";
import { createStudent } from "@mms/mod-students/backend/use-cases";
import { upsertContact } from "@mms/mod-contacts/backend/use-cases";
import { notificationsUseCases } from "@mms/mod-notifications/backend/use-cases";
import {
  settleEnrollmentWithdrawal,
  maybeGenerateInvoiceForEnrollment,
} from "@mms/mod-billing/backend/use-cases";
import { recordApprovedLeave } from "../../attendance/use-cases/attendanceLeaveUseCases.js";
import * as workspaceService from "../../services/workspaceService.js";
import { findWorkspaceTimezone } from "../../db/repositories/workspaceRepository.js";
import { sendTenantSms } from "../../services/sms/smsService.js";
import { sendTenantWhatsApp } from "../../services/whatsapp/whatsappService.js";
import { enqueueCsvExportJob, normalizeExportQuery } from "../../lib/csvExportEnqueue.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  getUserBackgroundJobPayload,
  hasBackgroundJobRunner,
  retryFailedBackgroundJob,
} from "../../services/backgroundJobWorkerService.js";
import {
  BackgroundJobLimitError,
  QueueUnavailableError,
} from "../../services/backgroundJobWorkerService.js";
import { registerModuleCsvExportJobRunner } from "../../lib/registerModuleCsvExportJobRunner.js";

export function configureEnrollmentsAdapters(): void {
  configureEnrollmentsPorts({
    findRegistrationLinkBySlugTx: sessions.findRegistrationLinkBySlugTx,
    findSessionById: sessions.findSessionById,
    findSessionsByIds: sessions.findSessionsByIds,
    getSessionModulePreferencesByWorkspace: sessions.getSessionModulePreferencesByWorkspace,
    listActiveRegistrationLinksTx: sessions.listActiveRegistrationLinksTx,
    lockRegistrationLinkTx: sessions.lockRegistrationLinkTx,
    syncEnrolledSessionsTx: students.syncEnrolledSessionsTx,
    enrollmentHoldsSeatWhere: sessions.enrollmentHoldsSeatWhere,
    enrollmentHoldsSeatSql: sessions.enrollmentHoldsSeatSql,
    closePlacementTx: sessions.closePlacementTx,
    insertTypedTimelineEventTx: sessions.insertTypedTimelineEventTx,
    movePlacementTx: sessions.movePlacementTx,
    lockAndAssertTargetSectionTx: sessions.lockAndAssertTargetSectionTx,
    countLiveSeatsByClassTx: sessions.countLiveSeatsByClassTx,
    countLiveSeatsBySectionTx: sessions.countLiveSeatsBySectionTx,
    loadEnrollmentSeatHoldersTx: sessions.loadEnrollmentSeatHoldersTx,
    lockSectionsForSeatsTx: sessions.lockSectionsForSeatsTx,
    lockRolloverCarryTx: sessions.lockRolloverCarryTx,
    recordEnrollmentSuspension: sessions.recordEnrollmentSuspension,
    appendClientTimelineTx: sessions.appendClientTimelineTx,
    syncPlacementsTx: sessions.syncPlacementsTx,
    cascadeSoftDeleteEnrollmentsForStudents: students.cascadeSoftDeleteEnrollmentsForStudents,
    restoreCascadedEnrollmentsForStudents: students.restoreCascadedEnrollmentsForStudents,
    restoreSessionWithCascade: sessions.restoreSessionWithCascade,
    softDeleteSessionWithCascade: sessions.softDeleteSessionWithCascade,
    saveSession: sessions.saveSession,
    transitionSession: sessionsUseCases.transitionSession,
    registrationLinkUseCases: sessionsUseCases,
    bulkSaveInvoices: (sessions as unknown as { bulkSaveInvoices?: unknown }).bulkSaveInvoices,
    bulkSoftDeleteStudentsSql: (students as unknown as { bulkSoftDeleteStudentsSql?: unknown })
      .bulkSoftDeleteStudentsSql,
    findStudentById: students.findStudentById,
    findStudentsByIds: students.findStudentsByIds,
    createStudent,
    upsertContact,
    notificationsUseCases,
    settleEnrollmentWithdrawal,
    maybeGenerateInvoiceForEnrollment,
    recordApprovedLeave,
    getWorkspaceBySubdomain: (subdomain: string) =>
      workspaceService.getWorkspaceBySubdomain(subdomain),
    fetchPublicBrandingForSubdomain: (subdomain: string) =>
      typeof workspaceService.fetchPublicBrandingForSubdomain === "function"
        ? workspaceService.fetchPublicBrandingForSubdomain(subdomain)
        : Promise.resolve({ madrasaName: "", logoUrl: null }),
    findWorkspaceTimezone: async (tenant: string) => findWorkspaceTimezone(tenant),
    enqueueCsvExportJob,
    normalizeExportQuery,
    enqueueBackgroundJob,
    getUserBackgroundJob,
    getUserBackgroundJobPayload,
    retryFailedBackgroundJob,
    hasBackgroundJobRunner,
    isBackgroundJobLimitError: (error: unknown) => error instanceof BackgroundJobLimitError,
    isQueueUnavailableError: (error: unknown) => error instanceof QueueUnavailableError,
    registerModuleCsvExportJobRunner: (options) =>
      registerModuleCsvExportJobRunner(
        options as Parameters<typeof registerModuleCsvExportJobRunner>[0],
      ),
    sendTenantSms,
    sendTenantWhatsApp,
  });
}

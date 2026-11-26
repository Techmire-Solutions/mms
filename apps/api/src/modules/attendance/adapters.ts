/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Composition adapter for the attendance module.
 *
 * Binds the module's ports to the sessions/enrollments/students/notifications/
 * hasanat modules, the app storage/xlsx/export plumbing and job services.
 */
import { configureAttendancePorts } from "@mms/mod-attendance/backend/deps";
import * as sessions from "@mms/mod-sessions/backend/repository";
import * as sessionsUseCases from "@mms/mod-sessions/backend/use-cases";
import * as enrollments from "@mms/mod-enrollments/backend/repository";
import * as students from "@mms/mod-students/backend/repository";
import { notificationsUseCases } from "@mms/mod-notifications/backend/use-cases";
import { findStudentsByNames } from "@mms/mod-hasanat/backend/repository";
import {
  resolveTenantExportKey,
  uploadBufferToStorage,
  uploadStreamToStorage,
} from "../../config/storage.js";
import { getWorkspaceTimezone } from "../../lib/workspaceTimezone.js";
import { findWorkspaceTimezone } from "../../db/repositories/workspaceRepository.js";
import { buildXlsxBuffer } from "../../lib/xlsxExportSerializer.js";
import {
  saveExportArtifact,
  saveStreamedExportArtifact,
} from "../../services/exportArtifactService.js";
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

export function configureAttendanceAdapters(): void {
  configureAttendancePorts({
    sessionsAcademicRepository: sessions.sessionsAcademicRepository,
    sessionsUseCases: sessionsUseCases,
    saveSession: sessions.saveSession,
    findSessionById: sessions.findSessionById,
    assertTeacherClassScope: sessionsUseCases.assertTeacherClassScope,
    assertTeacherSectionScope: sessionsUseCases.assertTeacherSectionScope,
    listEnrollmentPlacements: enrollments.listEnrollmentPlacements,
    listEnrollmentPlacementsAsOf: enrollments.listEnrollmentPlacementsAsOf,
    listEnrollmentPlacementsForDates: enrollments.listEnrollmentPlacementsForDates,
    listEnrollmentPlacementsTx: enrollments.listEnrollmentPlacementsTx,
    loadSessionWorkingDaysTx: sessions.loadSessionWorkingDaysTx,
    notificationsUseCases: notificationsUseCases,
    findStudentsByNames,
    findStudentById: students.findStudentById,
    findStudentsByIds: students.findStudentsByIds,
    findClassById: sessions.findClassById,
    findClassesByIds: sessions.findClassesByIds,
    findWorkspaceTimezone: (async (tenant: string) => findWorkspaceTimezone(tenant)) as never,
    getWorkspaceTimezone: (async (tenant: string) => getWorkspaceTimezone(tenant)) as never,
    getStorageConfig: () => ({}),
    buildXlsxBuffer: buildXlsxBuffer as never,
    xlsxExportSerializer: {},
    resolveTenantExportKey,
    uploadBufferToStorage,
    uploadStreamToStorage,
    saveExportArtifact: saveExportArtifact as never,
    saveStreamedExportArtifact,
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
  });
}

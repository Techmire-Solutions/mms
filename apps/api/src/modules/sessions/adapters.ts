/**
 * Composition adapter for the sessions module.
 *
 * Binds the module's kernel ports: enrollment transitions/rollover, attendance
 * calendar + countable SQL, faculty/students module reads, workspace timezone,
 * auth-artifact cleanup, platform settings and background-job plumbing.
 */
import { configureSessionsPorts } from "@mms/mod-sessions/backend/deps";
import {
  SYSTEM_ACTOR,
  completeLiveEnrollments,
  endLiveEnrollments,
} from "@mms/mod-enrollments/backend/use-cases";
import {
  bulkCloseRolloverSourceEnrollments,
  carryRolloverEnrollments,
  listRolloverCandidates,
} from "@mms/mod-enrollments/backend/use-cases";
import { bulkEnrollStudentsIntoClass } from "@mms/mod-enrollments/backend/use-cases";
import { copySessionCalendarEvents } from "@mms/mod-attendance/backend/use-cases";
import {
  streamAcademicCalendarCsv,
  streamAcademicCalendarIcs,
} from "@mms/mod-attendance/backend/use-cases";
import {
  loadCountableAttendanceSql,
  loadWorkspaceWeekdays,
} from "@mms/mod-attendance/backend/repository";
import { isPresentOrLateSql } from "@mms/mod-attendance/backend/repository";
import { findFacultyByIds } from "@mms/mod-faculty/backend/repository";
import {
  syncEnrolledSessionsTx,
  getPreparedSessionById,
} from "@mms/mod-students/backend/repository";
import { findWorkspaceTimezone } from "../../db/repositories/workspaceRepository.js";
import { getWorkspaceTimezone } from "../../lib/workspaceTimezone.js";
import { deleteRefreshTokensForUser } from "../../services/auth/authArtifactService.js";
import * as platformSettingsService from "../../services/platform/platformSettingsService.js";
import { getPlatformSettings } from "../../services/platform/platformSettingsService.js";
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

export function configureSessionsAdapters(): void {
  configureSessionsPorts({
    SYSTEM_ACTOR,
    completeLiveEnrollments,
    endLiveEnrollments,
    bulkCloseRolloverSourceEnrollments,
    carryRolloverEnrollments,
    listRolloverCandidates,
    bulkEnrollStudentsIntoClass,
    copySessionCalendarEvents,
    streamAcademicCalendarCsv,
    streamAcademicCalendarIcs,
    loadCountableAttendanceSql,
    isPresentOrLateSql,
    loadWorkspaceWeekdays,
    findFacultyByIds,
    syncEnrolledSessionsTx,
    getPreparedSessionById,
    findWorkspaceTimezone: async (tenant: string) => findWorkspaceTimezone(tenant),
    getWorkspaceTimezone: async (tenant: string) => getWorkspaceTimezone(tenant),
    deleteRefreshTokensForUser,
    getPlatformSettings,
    getPlatformIdleSessionMinutes: () => getPlatformSettings().idleSessionMinutes ?? 0,
    platformSettingsService,
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

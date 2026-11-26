/**
 * Composition adapter for the tasks module.
 *
 * Binds the module's ports to the notifications/messaging modules, the app users
 * services, faculty/contacts reads and background-job plumbing.
 */
import { configureTasksPorts } from "@mms/mod-tasks/backend/deps";
import { notificationsUseCases } from "@mms/mod-notifications/backend/use-cases";
import { messagingUseCases } from "@mms/mod-messaging/backend/use-cases";
import { dispatchMessagingCampaignDirect } from "@mms/mod-messaging/backend/services";
import { usersUseCases } from "../../users/use-cases/usersUseCases.js";
import { getTenantUsersSettings } from "../../services/users/usersSettingsService.js";
import { getTenantRoleCatalog, tenantUserHasPermission } from "../../lib/tenantRoleCatalog.js";
import { findFacultyByIds } from "@mms/mod-faculty/backend/repository";
import { lockFacultyHierarchy } from "@mms/mod-faculty/backend/repository";
import { loadContactsSummaryByIdsForTenant } from "@mms/mod-contacts/backend/services";
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

export function configureTasksAdapters(): void {
  configureTasksPorts({
    notificationsUseCases: notificationsUseCases,
    messagingUseCases: messagingUseCases,
    dispatchMessagingCampaignDirect,
    usersUseCases: usersUseCases,
    getTenantUsersSettings,
    getTenantRoleCatalog,
    tenantUserHasPermission,
    findFacultyByIds,
    lockFacultyHierarchy,
    loadContactsSummaryByIdsForTenant,
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

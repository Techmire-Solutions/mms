/**
 * Composition adapter for the students module.
 *
 * Binds the module's kernel ports to the app-only services it may not import:
 * contacts reconciliation, enrollment withdrawal/cascade, module-access denial,
 * CSV export enqueue and background-job plumbing.
 */
import { configureStudentPorts } from "@mms/mod-students/backend/deps";
import {
  upsertContact,
  findContactsMatchingUniqueValues,
  reconcileContactSystemTags,
  loadContactsByIdsForTenant,
  loadContactsSummaryByIdsForTenant,
} from "@mms/mod-contacts/backend/use-cases";
import { withdrawEnrollmentsForStudentStatus } from "@mms/mod-enrollments/backend/use-cases";
import { bulkEnrollStudentsIntoClass } from "@mms/mod-enrollments/backend/use-cases";
import { getModuleAccessDenial } from "../../middleware/requireTenantModule.js";
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

export function configureStudentsAdapters(): void {
  configureStudentPorts({
    upsertContact,
    findContactsMatchingUniqueValues,
    reconcileContactSystemTags,
    loadContactsByIdsForTenant,
    loadContactsSummaryByIdsForTenant,
    withdrawEnrollmentsForStudentStatus,
    bulkEnrollStudentsIntoClass,
    getModuleAccessDenial,
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

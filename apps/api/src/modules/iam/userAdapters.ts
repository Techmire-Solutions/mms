/**
 * Composition adapter for the IAM tenant (users) subtree.
 *
 * Binds contacts/faculty reads, activity-log storage, rate limiting, background-job
 * plumbing, auth-service helpers, workspace reads and user settings to the module.
 * All bindings forward through namespace calls so unit suites that partially mock
 * individual host modules do not trip missing-export getters during boot registration.
 */
import type { FastifyInstance } from "fastify";
import type { RateLimitPluginOptions } from "@fastify/rate-limit";
import {
  configureIamUsersPorts,
  type IamAsyncRouteGuard,
  type IamBackgroundJobRecord,
  type IamFacultyDesignationRecord,
  type IamFacultyRecordSnapshot,
  type IamPreparedTenantUserByIdStmt,
  type IamUsersPorts,
  type IamWorkspaceWithBranding,
  type PersistedUser,
} from "@mms/mod-iam/backend/tenant/deps";
import * as contactsServices from "@mms/mod-contacts/backend/services";
import * as facultyUseCases from "@mms/mod-faculty/backend/use-cases";
import * as facultyRepo from "@mms/mod-faculty/backend/repository";
import * as studentsRepo from "@mms/mod-students/backend/repository";
import * as logsRepo from "../../db/repositories/logsRepository.js";
import * as workspaceRepo from "../../db/repositories/workspaceRepository.js";
import * as workspaceService from "../../services/workspaceService.js";
import * as passwordService from "../../services/auth/passwordService.js";
import * as globalSettingsService from "../../services/globalSettingsService.js";
import * as userService from "../../services/auth/userService.js";
import * as userUiStateService from "../../services/auth/userUiStateService.js";
import * as userServiceShared from "../../services/auth/userServiceShared.js";
import * as otpDispatch from "../../services/auth/tenantPasswordOtpDispatch.js";
import * as authArtifactService from "../../services/auth/authArtifactService.js";
import * as rbacService from "../../services/rbacService.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";
import { AUTH_RATE_LIMIT } from "../../lib/rateLimitConfig.js";
import * as csvExportEnqueue from "../../lib/csvExportEnqueue.js";
import * as bgWorker from "../../services/backgroundJobWorkerService.js";
import { registerModuleCsvExportJobRunner } from "../../lib/registerModuleCsvExportJobRunner.js";

export function configureIamUsersAdapters(): void {
  const ports: IamUsersPorts = {
    loadContactsByIds: (ids) => contactsServices.loadContactsByIds(ids),
    findFacultyByContactId: async (tenant, contactId) =>
      (await facultyRepo.findFacultyByContactId(tenant, contactId)) as
        IamFacultyRecordSnapshot | null | undefined,
    isFacultyDesignationRoleLocked: (tenant, contactId) =>
      facultyUseCases.isFacultyDesignationRoleLocked(tenant, contactId),
    listFacultyDesignations: async (tenant, options) =>
      (await facultyRepo.listFacultyDesignations(
        tenant,
        options,
      )) as unknown as IamFacultyDesignationRecord[],
    resolveFacultyContactRoleAssignment: (tenant, contactId) =>
      facultyUseCases.resolveFacultyContactRoleAssignment(tenant, contactId),
    upsertFacultyManagedWorkspaceRole: (tenant, role) =>
      facultyUseCases.upsertFacultyManagedWorkspaceRole(tenant, role),
    mergeWorkspaceRolesForPrefsSave: async (incoming, existing) =>
      facultyUseCases.mergeWorkspaceRolesForPrefsSave(incoming, existing),
    findActivityLogById: (tenant, id) => logsRepo.findActivityLogById(tenant, id),
    findActivityLogsByIds: (tenant, ids) => logsRepo.findActivityLogsByIds(tenant, ids),
    listActivityLogsByWorkspace: (tenant) => logsRepo.listActivityLogsByWorkspace(tenant),
    saveActivityLog: async (tenant, record) => {
      await logsRepo.saveActivityLog(tenant, record);
    },
    bulkSaveActivityLogs: async (tenant, records) => {
      await logsRepo.bulkSaveActivityLogs(tenant, records);
    },
    replaceActivityLogsForWorkspace: async (tenant, records) => {
      await logsRepo.replaceActivityLogsForWorkspace(tenant, records);
    },
    getWorkspaceWithBranding: async (subdomain) =>
      (await workspaceRepo.getWorkspaceWithBranding(subdomain)) as
        IamWorkspaceWithBranding | null | undefined,
    findWorkspaceBySubdomain: (subdomain) => workspaceRepo.findWorkspaceRowBySubdomain(subdomain),
    findWorkspaceById: (subdomain) => workspaceRepo.findWorkspaceRowBySubdomain(subdomain),
    normalizeSubdomainInput: (subdomain) => workspaceService.normalizeSubdomainInput(subdomain),
    getGlobalSettings: (subdomain) => globalSettingsService.loadGlobalSettings(subdomain),
    hashPassword: (password) => passwordService.hashPassword(password),
    verifyPassword: (password, storedHash) => passwordService.verifyPassword(password, storedHash),
    changeTenantUserPassword: (...args: Parameters<typeof userService.changeTenantUserPassword>) =>
      userService.changeTenantUserPassword(...args),
    validateCredentials: (...args: Parameters<typeof userService.validateCredentials>) =>
      userService.validateCredentials(...args),
    userUiState: {},
    getUserUiState: (...args: Parameters<typeof userUiStateService.getUserUiState>) =>
      userUiStateService.getUserUiState(...args),
    patchUserUiState: (...args: Parameters<typeof userUiStateService.patchUserUiState>) =>
      userUiStateService.patchUserUiState(...args),
    assertPasswordMeetsPolicy: async (password) => {
      await globalSettingsService.assertPasswordMeetsPolicy(password);
    },
    getHydratedUsers: async (options) =>
      (await userService.getHydratedUsers(options)) as PersistedUser[],
    saveUsers: (users) =>
      userService.saveUsers(users as Parameters<typeof userService.saveUsers>[0]),
    getRawUsers: async () => (await userServiceShared.getRawUsers()) as PersistedUser[],
    sendTenantWelcomeEmail: (input) => otpDispatch.sendTenantWelcomeEmail(input),
    deleteRefreshTokensForUser: (userId) => authArtifactService.deleteRefreshTokensForUser(userId),
    getPreparedTenantUserById: (tx) =>
      studentsRepo.getPreparedTenantUserById(
        tx as Parameters<typeof studentsRepo.getPreparedTenantUserById>[0],
      ) as IamPreparedTenantUserByIdStmt | null | undefined,
    invalidateTenantRbac: (tenant) => rbacService.invalidateTenantRbac(tenant),
    createStrictRateLimitGuard: (scope: FastifyInstance, config?: Record<string, unknown>) =>
      createStrictRateLimitGuard(
        scope,
        (config as RateLimitPluginOptions | undefined) ?? AUTH_RATE_LIMIT,
      ) as unknown as IamAsyncRouteGuard,
    enqueueCsvExportJob: async (input) =>
      (await csvExportEnqueue.enqueueCsvExportJob(
        input as Parameters<typeof csvExportEnqueue.enqueueCsvExportJob>[0],
      )) as unknown as IamBackgroundJobRecord,
    normalizeExportQuery: (query, allowDeleted) =>
      csvExportEnqueue.normalizeExportQuery(query, allowDeleted),
    enqueueBackgroundJob: async (tenant, userId, job, payload) =>
      (await bgWorker.enqueueBackgroundJob(
        tenant,
        userId,
        job as unknown as Parameters<typeof bgWorker.enqueueBackgroundJob>[2],
        payload,
      )) as unknown as IamBackgroundJobRecord,
    getUserBackgroundJob: async (userId, jobId) =>
      (await bgWorker.getUserBackgroundJob(userId, jobId)) as unknown as
        IamBackgroundJobRecord | null | undefined,
    getUserBackgroundJobPayload: (userId, jobId) =>
      bgWorker.getUserBackgroundJobPayload(userId, jobId),
    retryFailedBackgroundJob: async (tenant, userId, existing, payload) =>
      (await bgWorker.retryFailedBackgroundJob(
        tenant,
        userId,
        existing as unknown as Parameters<typeof bgWorker.retryFailedBackgroundJob>[2],
        payload,
      )) as unknown as IamBackgroundJobRecord,
    hasBackgroundJobRunner: (jobId) => bgWorker.hasBackgroundJobRunner(jobId),
    isBackgroundJobLimitError: (error) => error instanceof bgWorker.BackgroundJobLimitError,
    isQueueUnavailableError: (error) => error instanceof bgWorker.QueueUnavailableError,
    registerModuleCsvExportJobRunner: (options) =>
      registerModuleCsvExportJobRunner(
        options as Parameters<typeof registerModuleCsvExportJobRunner>[0],
      ),
  };
  configureIamUsersPorts(ports);
}

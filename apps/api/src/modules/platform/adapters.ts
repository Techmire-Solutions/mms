/**
 * Composition adapter for the platform console module.
 *
 * Every port is bound via a lazy getter onto the module namespace that provided
 * it before extraction. Production boot (`NODE_ENV !== "test"`) validates every
 * getter once in `configurePlatformPorts`, while unit suites using partial
 * `vi.mock()` without `importOriginal` never touch unrelated exports at boot.
 */
import { configurePlatformPorts } from "@mms/mod-platform/backend/platform/deps";
import * as sessionEstablishment from "../../services/auth/sessionEstablishment.js";
import * as initializeDbMod from "../../bootstrap/initializeDatabase.js";
import * as loadEnvMod from "../../config/loadEnv.js";
import * as workspaceRepo from "../../db/repositories/workspaceRepository.js";
import * as integrationConfigMod from "../../lib/createIntegrationConfigService.js";
import * as moduleAvailabilityMod from "../../lib/moduleAvailabilityService.js";
import * as registerIntegrationMod from "../../lib/registerIntegrationRoutes.js";
import * as authPlatformMod from "../../middleware/authenticatePlatform.js";
import * as authArtifactMod from "../../services/auth/authArtifactService.js";
import * as authCookieMod from "../../services/auth/authCookieService.js";
import * as authServiceMod from "../../services/auth/authService.js";
import * as otpChallengeMod from "../../services/auth/otpChallengeService.js";
import * as passwordMod from "../../services/auth/passwordService.js";
import * as llmModelsMod from "../../services/llmModelsService.js";
import * as llmServiceMod from "../../services/llmService.js";
import * as sendSmsMod from "../../services/sms/sendSmsViaProvider.js";
import * as workspaceServiceMod from "../../services/workspaceService.js";
import * as cryptoAtRestMod from "@mms/be-core/audit/cryptoAtRest";
import * as beCoreAuth from "@mms/be-core/auth";
import * as sessionClockMod from "@mms/be-core/auth/sessionClock";
import * as sessionPolicyMod from "@mms/be-core/auth/sessionPolicy";
import * as beCoreTransports from "@mms/be-core/transports";
import * as accountingRepo from "@mms/mod-accounting/backend/repository";
import * as auditRepo from "@mms/mod-audit/backend/repository";
import * as auditServices from "@mms/mod-audit/backend/services";
import * as contactsRepo from "@mms/mod-contacts/backend/repository";
import * as iamTenantRepo from "@mms/mod-iam/backend/tenant/repository";
import * as platformServices from "@mms/mod-platform/backend/platform/services";
import * as sessionsServices from "@mms/mod-sessions/backend/services";

export function configurePlatformAdapters(): void {
  configurePlatformPorts({
    get establishSessionShared() {
      return sessionEstablishment.establishSession;
    },
    get initializeDatabase() {
      return initializeDbMod.initializeDatabase;
    },
    get resolveBackendRoot() {
      return loadEnvMod.resolveBackendRoot;
    },
    get listWorkspaceRows() {
      return workspaceRepo.listWorkspaceRows;
    },
    get createIntegrationConfigService() {
      return integrationConfigMod.createIntegrationConfigService;
    },
    get clearModuleAvailabilityCache() {
      return moduleAvailabilityMod.clearModuleAvailabilityCache;
    },
    get registerIntegrationRoutes() {
      return registerIntegrationMod.registerIntegrationRoutes;
    },
    get authenticatePlatform() {
      return authPlatformMod.authenticatePlatform;
    },
    get optionalAuthenticatePlatform() {
      return authPlatformMod.optionalAuthenticatePlatform;
    },
    get requirePlatformPermission() {
      return authPlatformMod.requirePlatformPermission;
    },
    get requirePlatformSuperUser() {
      return authPlatformMod.requirePlatformSuperUser;
    },
    get createArtifactId() {
      return authArtifactMod.createArtifactId;
    },
    get deleteAuthArtifact() {
      return authArtifactMod.deleteAuthArtifact;
    },
    get deleteRefreshTokensForUser() {
      return authArtifactMod.deleteRefreshTokensForUser;
    },
    get getAuthArtifact() {
      return authArtifactMod.getAuthArtifact;
    },
    get putAuthArtifact() {
      return authArtifactMod.putAuthArtifact;
    },
    get takeAuthArtifact() {
      return authArtifactMod.takeAuthArtifact;
    },
    get clearAuthCookies() {
      return authCookieMod.clearAuthCookies;
    },
    get setAuthCookies() {
      return authCookieMod.setAuthCookies;
    },
    get setCsrfCookie() {
      return authCookieMod.setCsrfCookie;
    },
    get establishSession() {
      return authServiceMod.establishSession;
    },
    get createOtpChallengeService() {
      return otpChallengeMod.createOtpChallengeService;
    },
    get DUMMY_PASSWORD_HASH() {
      return passwordMod.DUMMY_PASSWORD_HASH;
    },
    get hashPassword() {
      return passwordMod.hashPassword;
    },
    get verifyPassword() {
      return passwordMod.verifyPassword;
    },
    get fetchLlmModels() {
      return llmModelsMod.fetchLlmModels;
    },
    get generateCompletion() {
      return llmServiceMod.generateCompletion;
    },
    get sendSmsViaProvider() {
      return sendSmsMod.sendSmsViaProvider;
    },
    get deleteWorkspace() {
      return workspaceServiceMod.deleteWorkspace;
    },
    get getPlatformWorkspaceMetrics() {
      return workspaceServiceMod.getPlatformWorkspaceMetrics;
    },
    get getPlatformWorkspaceSummary() {
      return workspaceServiceMod.getPlatformWorkspaceSummary;
    },
    get getWorkspaceGrantedModules() {
      return workspaceServiceMod.getWorkspaceGrantedModules;
    },
    get listPlatformWorkspaces() {
      return workspaceServiceMod.listPlatformWorkspaces;
    },
    get renamePlatformWorkspace() {
      return workspaceServiceMod.renamePlatformWorkspace;
    },
    get setWorkspaceEmailVerification() {
      return workspaceServiceMod.setWorkspaceEmailVerification;
    },
    get setWorkspaceEnabled() {
      return workspaceServiceMod.setWorkspaceEnabled;
    },
    get updateWorkspaceModules() {
      return workspaceServiceMod.updateWorkspaceModules;
    },
    get decryptSecretAtRest() {
      return cryptoAtRestMod.decryptSecretAtRest;
    },
    get encryptSecretAtRest() {
      return cryptoAtRestMod.encryptSecretAtRest;
    },
    get secureCookieBase() {
      return beCoreAuth.secureCookieBase;
    },
    get requireMainDomain() {
      return beCoreAuth.requireMainDomain;
    },
    get touchSession() {
      return sessionClockMod.touchSession;
    },
    get platformSessionPolicy() {
      return sessionPolicyMod.platformSessionPolicy;
    },
    get attachTokenFromCookie() {
      return beCoreAuth.attachTokenFromCookie;
    },
    get buildHtmlFallback() {
      return beCoreTransports.buildHtmlFallback;
    },
    get createSmtpTransporter() {
      return beCoreTransports.createSmtpTransporter;
    },
    get resolveSmtpTransportOptions() {
      return beCoreTransports.resolveSmtpTransportOptions;
    },
    get sendMailViaSmtp() {
      return beCoreTransports.sendMailViaSmtp;
    },
    get verifySmtpConnection() {
      return beCoreTransports.verifySmtpConnection;
    },
    get fetchWithTimeout() {
      return beCoreTransports.fetchWithTimeout;
    },
    get isBlockedHostname() {
      return beCoreTransports.isBlockedHostname;
    },
    get ensureCurrencySettingsInTx() {
      return accountingRepo.ensureCurrencySettingsInTx;
    },
    get getPostingRules() {
      return accountingRepo.getPostingRules;
    },
    get aggregateAccountingReport() {
      return accountingRepo.aggregateAccountingReport;
    },
    get listGlobalMerkleRoots() {
      return auditRepo.listGlobalMerkleRoots;
    },
    get computeAndPublishMerkleCheckpoint() {
      return auditServices.computeAndPublishMerkleCheckpoint;
    },
    get listPlatformContacts() {
      return contactsRepo.listPlatformContacts;
    },
    get verifyTenantUserEmailRow() {
      return iamTenantRepo.verifyTenantUserEmailRow;
    },
    get findTenantUserRowById() {
      return iamTenantRepo.findTenantUserRowById;
    },
    get createWorkspaceAdminUser() {
      return iamTenantRepo.createWorkspaceAdminUser;
    },
    get resetWorkspaceAdminPassword() {
      return iamTenantRepo.resetWorkspaceAdminPassword;
    },
    get setPlatformSettingsCache() {
      return platformServices.setPlatformSettingsCache;
    },
    get platformSessionScope() {
      return sessionsServices.platformSessionScope;
    },
  });
}

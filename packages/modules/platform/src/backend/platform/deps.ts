/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  PLATFORM_PORT_NAMES,
  configurePlatformPorts,
  platformPort,
  requirePlatformPorts,
  type EmailIntegrationConfig,
  type EmailIntegrationSecrets,
  type LlmConfig,
  type OtpChallengePayload,
  type OtpDispatchResult,
  type PlatformAdminPermissions,
  type PlatformErrorCode,
  type PlatformPorts,
} from "./ports.js";

export {
  PLATFORM_PORT_NAMES,
  configurePlatformPorts,
  platformPort,
  type EmailIntegrationConfig,
  type EmailIntegrationSecrets,
  type LlmConfig,
  type OtpChallengePayload,
  type OtpDispatchResult,
  type PlatformAdminPermissions,
  type PlatformErrorCode,
  type PlatformPorts,
};

function callPort(name: string, args: any[]): any {
  const p = requirePlatformPorts()[name];
  return typeof p === "function" ? p(...args) : p;
}

export const aggregateAccountingReport = (...args: any[]): any =>
  callPort("aggregateAccountingReport", args);
export const attachTokenFromCookie = (...args: any[]): any =>
  callPort("attachTokenFromCookie", args);
export const authenticatePlatform = (...args: any[]): any => callPort("authenticatePlatform", args);
export const buildHtmlFallback = (...args: any[]): any => callPort("buildHtmlFallback", args);
export const clearAuthCookies = (...args: any[]): any => callPort("clearAuthCookies", args);
export const clearModuleAvailabilityCache = (...args: any[]): any =>
  callPort("clearModuleAvailabilityCache", args);
export const computeAndPublishMerkleCheckpoint = (...args: any[]): any =>
  callPort("computeAndPublishMerkleCheckpoint", args);
export const createArtifactId = (...args: any[]): any => callPort("createArtifactId", args);
export function createIntegrationConfigService<A = any, B = any, C = any>(...args: any[]): any {
  void (null as unknown as [A, B, C]);
  return callPort("createIntegrationConfigService", args);
}
export function createOtpChallengeService<A = any, B = any, C = any, D = any>(...args: any[]): any {
  void (null as unknown as [A, B, C, D]);
  return callPort("createOtpChallengeService", args);
}
export const createSmtpTransporter = (...args: any[]): any =>
  callPort("createSmtpTransporter", args);
export const createWorkspaceAdminUser = (...args: any[]): any =>
  callPort("createWorkspaceAdminUser", args);
export const decryptSecretAtRest = (...args: any[]): any => callPort("decryptSecretAtRest", args);
export const deleteAuthArtifact = (...args: any[]): any => callPort("deleteAuthArtifact", args);
export const deleteWorkspace = (...args: any[]): any => callPort("deleteWorkspace", args);
export const encryptSecretAtRest = (...args: any[]): any => callPort("encryptSecretAtRest", args);
export const ensureCurrencySettingsInTx = (...args: any[]): any =>
  callPort("ensureCurrencySettingsInTx", args);
export const establishSessionShared = (...args: any[]): any =>
  callPort("establishSessionShared", args);
export const establishSession = (...args: any[]): any => callPort("establishSession", args);
export const fetchLlmModels = (...args: any[]): any => callPort("fetchLlmModels", args);
export const fetchWithTimeout = (...args: any[]): any => callPort("fetchWithTimeout", args);
export const findTenantUserRowById = (...args: any[]): any =>
  callPort("findTenantUserRowById", args);
export const generateCompletion = (...args: any[]): any => callPort("generateCompletion", args);
export function getAuthArtifact<A = any, B = any, C = any, D = any>(...args: any[]): any {
  void (null as unknown as [A, B, C, D]);
  return callPort("getAuthArtifact", args);
}
export const getPlatformWorkspaceMetrics = (...args: any[]): any =>
  callPort("getPlatformWorkspaceMetrics", args);
export const getPlatformWorkspaceSummary = (...args: any[]): any =>
  callPort("getPlatformWorkspaceSummary", args);
export const getPostingRules = (...args: any[]): any => callPort("getPostingRules", args);
export const getWorkspaceGrantedModules = (...args: any[]): any =>
  callPort("getWorkspaceGrantedModules", args);
export const hashPassword = (...args: any[]): any => callPort("hashPassword", args);
export const initializeDatabase = (...args: any[]): any => callPort("initializeDatabase", args);
export const isBlockedHostname = (...args: any[]): any => callPort("isBlockedHostname", args);
export const listGlobalMerkleRoots = (...args: any[]): any =>
  callPort("listGlobalMerkleRoots", args);
export const listPlatformContacts = (...args: any[]): any => callPort("listPlatformContacts", args);
export const listPlatformWorkspaces = (...args: any[]): any =>
  callPort("listPlatformWorkspaces", args);
export const listWorkspaceRows = (...args: any[]): any => callPort("listWorkspaceRows", args);
export const optionalAuthenticatePlatform = (...args: any[]): any =>
  callPort("optionalAuthenticatePlatform", args);
export const platformSessionPolicy = (...args: any[]): any =>
  callPort("platformSessionPolicy", args);
export const platformSessionScope = (...args: any[]): any => callPort("platformSessionScope", args);
export const putAuthArtifact = (...args: any[]): any => callPort("putAuthArtifact", args);
export function registerIntegrationRoutes<A = any, B = any, C = any, D = any>(...args: any[]): any {
  void (null as unknown as [A, B, C, D]);
  return callPort("registerIntegrationRoutes", args);
}
export const renamePlatformWorkspace = (...args: any[]): any =>
  callPort("renamePlatformWorkspace", args);
export const requireMainDomain = (...args: any[]): any => callPort("requireMainDomain", args);
export const requirePlatformPermission = (...args: any[]): any =>
  callPort("requirePlatformPermission", args);
export const requirePlatformSuperUser = (...args: any[]): any =>
  callPort("requirePlatformSuperUser", args);
export const resetWorkspaceAdminPassword = (...args: any[]): any =>
  callPort("resetWorkspaceAdminPassword", args);
export const resolveBackendRoot = (...args: any[]): any => callPort("resolveBackendRoot", args);
export const resolveSmtpTransportOptions = (...args: any[]): any =>
  callPort("resolveSmtpTransportOptions", args);
export const secureCookieBase = (...args: any[]): any => callPort("secureCookieBase", args);
export const sendMailViaSmtp = (...args: any[]): any => callPort("sendMailViaSmtp", args);
export const sendSmsViaProvider = (...args: any[]): any => callPort("sendSmsViaProvider", args);
export const setCsrfCookie = (...args: any[]): any => callPort("setCsrfCookie", args);
export const setWorkspaceEmailVerification = (...args: any[]): any =>
  callPort("setWorkspaceEmailVerification", args);
export const setWorkspaceEnabled = (...args: any[]): any => callPort("setWorkspaceEnabled", args);
export function takeAuthArtifact<A = any, B = any, C = any, D = any>(...args: any[]): any {
  void (null as unknown as [A, B, C, D]);
  return callPort("takeAuthArtifact", args);
}
export const touchSession = (...args: any[]): any => callPort("touchSession", args);
export const updateWorkspaceModules = (...args: any[]): any =>
  callPort("updateWorkspaceModules", args);
export const verifyPassword = (...args: any[]): any => callPort("verifyPassword", args);
export const verifySmtpConnection = (...args: any[]): any => callPort("verifySmtpConnection", args);
export const verifyTenantUserEmailRow = (...args: any[]): any =>
  callPort("verifyTenantUserEmailRow", args);

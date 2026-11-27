import type {
  EmailIntegrationConfig,
  EmailIntegrationSecrets,
  LlmConfig,
  PlatformAdminPermissions,
  PlatformServiceErrorCode,
} from "@mms/contracts";

export type PlatformErrorCode = PlatformServiceErrorCode;

/**
 * App-bound ports for the platform console module.
 *
 * Stored on `globalThis` via `Symbol.for("@mms/mod-platform/ports")` so dual
 * ESM evaluations (compiled `dist/` vs Vite-inlined `src/` in DB/unit suites)
 * always share a single composition-root binding.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PlatformPorts = Record<string, any>;

/** Every port the module resolves; the composition root must bind all of them. */
export const PLATFORM_PORT_NAMES = [
  "DUMMY_PASSWORD_HASH",
  "aggregateAccountingReport",
  "attachTokenFromCookie",
  "authenticatePlatform",
  "buildHtmlFallback",
  "clearAuthCookies",
  "clearModuleAvailabilityCache",
  "computeAndPublishMerkleCheckpoint",
  "createArtifactId",
  "createIntegrationConfigService",
  "createOtpChallengeService",
  "createSmtpTransporter",
  "createWorkspaceAdminUser",
  "decryptSecretAtRest",
  "deleteAuthArtifact",
  "deleteWorkspace",
  "encryptSecretAtRest",
  "ensureCurrencySettingsInTx",
  "establishSession",
  "establishSessionShared",
  "fetchLlmModels",
  "fetchWithTimeout",
  "findTenantUserRowById",
  "generateCompletion",
  "getAuthArtifact",
  "getPlatformWorkspaceMetrics",
  "getPlatformWorkspaceSummary",
  "getPostingRules",
  "getWorkspaceGrantedModules",
  "hashPassword",
  "initializeDatabase",
  "isBlockedHostname",
  "listGlobalMerkleRoots",
  "listPlatformContacts",
  "listPlatformWorkspaces",
  "listWorkspaceRows",
  "optionalAuthenticatePlatform",
  "platformSessionPolicy",
  "platformSessionScope",
  "putAuthArtifact",
  "registerIntegrationRoutes",
  "renamePlatformWorkspace",
  "requireMainDomain",
  "requirePlatformPermission",
  "requirePlatformSuperUser",
  "resetWorkspaceAdminPassword",
  "resolveBackendRoot",
  "resolveSmtpTransportOptions",
  "secureCookieBase",
  "sendMailViaSmtp",
  "sendSmsViaProvider",
  "setCsrfCookie",
  "setWorkspaceEmailVerification",
  "setWorkspaceEnabled",
  "takeAuthArtifact",
  "touchSession",
  "updateWorkspaceModules",
  "verifyPassword",
  "verifySmtpConnection",
  "verifyTenantUserEmailRow",
] as const;

const PORTS_KEY = Symbol.for("@mms/mod-platform/ports");
type GlobalWithPlatformPorts = typeof globalThis & { [PORTS_KEY]?: PlatformPorts | null };

/** Resolve one bound port value (for constants that must not be call-wrapped). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function platformPort<T = any>(name: string): T {
  return requirePlatformPorts()[name] as T;
}

/** Composition-root binding; called once from `apps/api` before routes load. */
export function configurePlatformPorts(next: PlatformPorts): void {
  if (process.env.NODE_ENV !== "test") {
    const missing = PLATFORM_PORT_NAMES.filter((name) => next[name] === undefined);
    if (missing.length > 0) {
      throw new Error(`Platform ports not bound: ${missing.join(", ")}`);
    }
  }
  (globalThis as GlobalWithPlatformPorts)[PORTS_KEY] = next;
}

export function requirePlatformPorts(): PlatformPorts {
  const current = (globalThis as GlobalWithPlatformPorts)[PORTS_KEY];
  if (!current) {
    throw new Error("Platform ports are not configured (call configurePlatformPorts)");
  }
  return current;
}

export interface OtpChallengePayload {
  codeHash: string;
  attempts: number;
}

export interface OtpDispatchResult {
  sent: boolean;
  devCode?: string;
}

export type {
  EmailIntegrationConfig,
  EmailIntegrationSecrets,
  LlmConfig,
  PlatformAdminPermissions,
};

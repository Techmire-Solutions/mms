import {
  resolvePlatformSessionPolicy,
  resolveTenantSessionPolicy,
  type SessionTimeoutPolicy,
} from "@mms/shared";

function envInt(name: string): number | undefined {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

/**
 * Resolves the tenant session policy from the workspace `sessionTimeout` global
 * setting. The optional absolute cap comes from `MMS_SESSION_ABSOLUTE_TIMEOUT_MINUTES`
 * (runtime env, default none). All other defaults live in the shared resolver.
 */
export function tenantSessionPolicy(sessionTimeoutMinutes?: number): SessionTimeoutPolicy {
  return resolveTenantSessionPolicy(
    sessionTimeoutMinutes,
    undefined,
    envInt("MMS_SESSION_ABSOLUTE_TIMEOUT_MINUTES"),
  );
}

/**
 * Resolves the apex platform session policy from runtime env
 * (`PLATFORM_SESSION_IDLE_MINUTES`, `PLATFORM_SESSION_WARN_SECONDS`,
 * `PLATFORM_SESSION_ABSOLUTE_MINUTES`). Re-read per call so operators can tune
 * timeouts without redeploying code. All fallbacks live in the shared resolver.
 */
export function platformSessionPolicy(): SessionTimeoutPolicy {
  return resolvePlatformSessionPolicy(
    envInt("PLATFORM_SESSION_IDLE_MINUTES"),
    envInt("PLATFORM_SESSION_WARN_SECONDS"),
    envInt("PLATFORM_SESSION_ABSOLUTE_MINUTES"),
  );
}

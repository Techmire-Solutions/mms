import {
  PLATFORM_IDLE_SESSION_TIMEOUT_MINUTES,
  resolvePlatformSessionPolicy,
  resolveTenantSessionPolicy,
  type SessionTimeoutPolicy,
} from "@mms/contracts";
import { getPlatformSettings } from "./platform/platformSettingsService.js";

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
 * Resolves the apex platform session policy. The Settings → General idle timeout
 * is authoritative when configured; `PLATFORM_SESSION_IDLE_MINUTES` remains the
 * fallback for installs that never saved the setting (and for the default value).
 * `PLATFORM_SESSION_WARN_SECONDS` / `PLATFORM_SESSION_ABSOLUTE_MINUTES` still come
 * from runtime env. All fallbacks live in the shared resolver.
 */
export function platformSessionPolicy(): SessionTimeoutPolicy {
  const configured = getPlatformSettings().idleSessionMinutes;
  const envIdle = envInt("PLATFORM_SESSION_IDLE_MINUTES");
  const idle =
    configured === PLATFORM_IDLE_SESSION_TIMEOUT_MINUTES && envIdle !== undefined
      ? envIdle
      : configured;
  return resolvePlatformSessionPolicy(
    idle,
    envInt("PLATFORM_SESSION_WARN_SECONDS"),
    envInt("PLATFORM_SESSION_ABSOLUTE_MINUTES"),
  );
}

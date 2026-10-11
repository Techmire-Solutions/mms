import { PLATFORM_IDLE_SESSION_TIMEOUT_MINUTES } from "./platformTypes.js";

/**
 * Dynamic session timeout policy for tenant and platform sessions.
 *
 * This module is the single source of truth for how a session policy is resolved:
 * given an idle-timeout (minutes), an optional warning lead time, and an optional
 * absolute maximum lifetime, it returns the concrete `SessionTimeoutPolicy`.
 * All fallback defaults live here (never duplicated in callers).
 */

export interface SessionTimeoutPolicy {
  /** Inactivity window in ms after which an authenticated session is idle-expired. */
  idleMs: number;
  /** How long (ms) before the idle deadline to start warning the user. */
  warnBeforeMs: number;
  /**
   * Hard maximum session lifetime (ms) regardless of activity, or null for no cap.
   * A session is forcibly ended once `now - sessionStartedAt >= absoluteMs`.
   */
  absoluteMs: number | null;
}

/** Default idle window for a tenant workspace when unset/invalid (minutes). */
export const DEFAULT_TENANT_SESSION_IDLE_MINUTES = 60;

/** Default warning lead time (60s) before the idle deadline. */
export const DEFAULT_WARN_BEFORE_SECONDS = 60;
export const DEFAULT_WARN_BEFORE_MS = DEFAULT_WARN_BEFORE_SECONDS * 1000;

/** Absolute cap on a configurable idle window (24h) to bound misconfiguration. */
export const MAX_SESSION_IDLE_MINUTES = 24 * 60;

/** Absolute cap on a configurable maximum session lifetime (7 days). */
export const MAX_SESSION_ABSOLUTE_MINUTES = 7 * 24 * 60;

function clampMinutes(minutes: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(minutes) || (minutes as number) <= 0) return fallback;
  return Math.min(Math.floor(minutes as number), max);
}

/** Resolves the absolute cap (ms) or null. */
function absoluteMs(minutes?: number): number | null {
  if (minutes && Number.isFinite(minutes) && minutes > 0) {
    return clampMinutes(minutes, 0, MAX_SESSION_ABSOLUTE_MINUTES) * 60_000;
  }
  return null;
}

/** Warning lead time, never exceeding half the idle window. */
function warnFor(idleMs: number, configuredSeconds?: number): number {
  if (configuredSeconds && Number.isFinite(configuredSeconds) && configuredSeconds > 0) {
    return Math.min(Math.round(configuredSeconds) * 1000, Math.floor(idleMs / 2));
  }
  return Math.min(DEFAULT_WARN_BEFORE_MS, Math.floor(idleMs / 4));
}

/**
 * Resolves the tenant session policy from the configured session timeout
 * (minutes). Idle defaults to `DEFAULT_TENANT_SESSION_IDLE_MINUTES` (60) when
 * unset/invalid. `absoluteMinutes` is the optional hard session cap (null = none).
 */
export function resolveTenantSessionPolicy(
  sessionTimeoutMinutes?: number,
  warnBeforeSeconds?: number,
  absoluteMinutes?: number,
): SessionTimeoutPolicy {
  const idleMs =
    clampMinutes(
      sessionTimeoutMinutes,
      DEFAULT_TENANT_SESSION_IDLE_MINUTES,
      MAX_SESSION_IDLE_MINUTES,
    ) * 60_000;
  return {
    idleMs,
    warnBeforeMs: warnFor(idleMs, warnBeforeSeconds),
    absoluteMs: absoluteMs(absoluteMinutes),
  };
}

/**
 * Resolves the platform session policy from the configured idle timeout (minutes).
 * Idle defaults to `PLATFORM_IDLE_SESSION_TIMEOUT_MINUTES` (30) when unset/invalid.
 * `absoluteMinutes` is the optional hard session cap (null = none).
 */
export function resolvePlatformSessionPolicy(
  idleMinutes?: number,
  warnBeforeSeconds?: number,
  absoluteMinutes?: number,
): SessionTimeoutPolicy {
  const idleMs =
    clampMinutes(idleMinutes, PLATFORM_IDLE_SESSION_TIMEOUT_MINUTES, MAX_SESSION_IDLE_MINUTES) *
    60_000;
  return {
    idleMs,
    warnBeforeMs: warnFor(idleMs, warnBeforeSeconds),
    absoluteMs: absoluteMs(absoluteMinutes),
  };
}

import { redisDel, redisGet, redisSet } from "../lib/redis.js";
import { revokeToken } from "./authSessionService.js";

const SESSION_ACTIVITY_PREFIX = "session:idle:";
const SESSION_CLOCK_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days: retain clock record across idle windows until explicit logout/expiry

/**
 * In-process touch throttle: avoids a Redis write on every authenticated request.
 * Reads still hit Redis, so idle enforcement stays correct/cluster-wide; only the
 * write frequency is reduced.
 */
const touchThrottle = new Map<string, number>();
const TOUCH_THROTTLE_MS = 60_000;
const TOUCH_THROTTLE_MAX_ENTRIES = 5_000;

function setTouchThrottle(scope: string, now: number): void {
  if (touchThrottle.size >= TOUCH_THROTTLE_MAX_ENTRIES) {
    const cutoff = now - TOUCH_THROTTLE_MS * 2;
    for (const [s, ts] of touchThrottle.entries()) {
      if (ts < cutoff) {
        touchThrottle.delete(s);
      }
    }
    if (touchThrottle.size >= TOUCH_THROTTLE_MAX_ENTRIES) {
      touchThrottle.clear();
    }
  }
  touchThrottle.set(scope, now);
}

interface SessionClockRecord {
  /** last-activity epoch ms. */
  a: number;
  /** session started-at epoch ms (for the absolute lifetime cap). */
  s: number;
}

function activityKey(scope: string): string {
  return `${SESSION_ACTIVITY_PREFIX}${scope}`;
}

async function readClock(scope: string): Promise<SessionClockRecord | null> {
  const raw = await redisGet(activityKey(scope));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionClockRecord;
    if (Number.isFinite(parsed.a) && Number.isFinite(parsed.s)) return parsed;
    const legacyTs = Number.parseInt(raw, 10);
    return Number.isNaN(legacyTs) ? null : { a: legacyTs, s: legacyTs };
  } catch {
    return null;
  }
}

/** Canonical idle-clock scope for a tenant workspace user. */
export function tenantSessionScope(subdomain: string, userId: string): string {
  return `tn:${subdomain.trim().toLowerCase()}:${userId}`;
}

/** Canonical idle-clock scope for a platform operator. */
export function platformSessionScope(userId: string): string {
  return `plat:${userId}`;
}

/**
 * Resets the session clock completely (both last-activity and session-start) to `now`.
 * Must be called upon new session creation (login, password reset, 2FA verify) so stale
 * clock records from prior sessions do not spuriously expire the new session.
 */
export async function resetSessionClock(scope: string, idleMs: number): Promise<void> {
  if (!scope) return;
  const now = Date.now();
  touchThrottle.delete(scope);
  setTouchThrottle(scope, now);

  const record: SessionClockRecord = {
    a: now,
    s: now,
  };
  const ttlSeconds = Math.max(SESSION_CLOCK_TTL_SECONDS, Math.ceil(idleMs / 1000));
  await redisSet(activityKey(scope), JSON.stringify(record), ttlSeconds);
}

/** Records `now` as the last-activity time, preserving the session start. */
export async function touchSession(scope: string, idleMs: number, force = false): Promise<void> {
  if (!scope) return;
  const now = Date.now();
  // Never throttle longer than half the idle window: with a 1-minute idle policy
  // the fixed 60s throttle could drop an activity just after the window while
  // the stored timestamp was already past `idleMs`, expiring an active session.
  const effectiveThrottleMs = idleMs > 0 ? Math.min(TOUCH_THROTTLE_MS, Math.floor(idleMs / 2)) : 0;
  const last = touchThrottle.get(scope);
  if (!force && effectiveThrottleMs > 0 && last !== undefined && now - last < effectiveThrottleMs)
    return;
  setTouchThrottle(scope, now);

  const existing = await readClock(scope);
  const record: SessionClockRecord = {
    a: now,
    s: existing?.s ?? now, // first activity establishes the session start
  };
  const ttlSeconds = Math.max(SESSION_CLOCK_TTL_SECONDS, Math.ceil(idleMs / 1000));
  await redisSet(activityKey(scope), JSON.stringify(record), ttlSeconds);
}

/** Returns the last-activity timestamp (ms epoch), or null if never set. */
export async function sessionLastActivityMs(scope: string): Promise<number | null> {
  const record = await readClock(scope);
  return record?.a ?? null;
}

/** Returns the session started-at timestamp (ms epoch), or null if never set. */
export async function sessionStartedAtMs(scope: string): Promise<number | null> {
  const record = await readClock(scope);
  return record?.s ?? null;
}

/**
 * True when the session has been idle for >= `idleMs`. When no record exists
 * (e.g. a mid-flight session), returns false so the access-token TTL remains the
 * backstop rather than spuriously expiring an active session.
 */
export async function isSessionIdleExpired(scope: string, idleMs: number): Promise<boolean> {
  const last = await sessionLastActivityMs(scope);
  if (last === null) return false;
  return Date.now() - last >= idleMs;
}

/**
 * True when the session has exceeded its absolute maximum lifetime. Always false
 * when `absoluteMs` is null/0 or the session start is unknown.
 */
export async function isSessionAbsoluteExpired(
  scope: string,
  absoluteMs?: number | null,
): Promise<boolean> {
  if (!absoluteMs || absoluteMs <= 0) return false;
  const started = await sessionStartedAtMs(scope);
  if (started === null) return false;
  return Date.now() - started >= absoluteMs;
}

/** Clears the idle clock and revokes the underlying access token (jti). */
export async function revokeSession(scope: string, jti?: string): Promise<void> {
  touchThrottle.delete(scope);
  await redisDel(activityKey(scope));
  if (jti) await revokeToken(jti);
}

/** Test helper — clears the in-process throttle map. */
export function clearSessionClockThrottleForTests(): void {
  touchThrottle.clear();
}

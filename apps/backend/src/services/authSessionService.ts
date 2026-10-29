import {
  redisBatch,
  redisDel,
  redisDelPattern,
  redisExists,
  redisGet,
  redisSet,
  redisKeys,
  type RedisBatchOp,
} from "../lib/redis.js";

const REVOKED_TOKEN_PREFIX = "session:revoked:";
const USER_REVOKED_AT_PREFIX = "user:revoked_at:";
const TENANT_BLOCKED_PREFIX = "tenant:blocked:";

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

/**
 * Revokes all session cache keys matching mms:session:${userId}:* in Redis.
 */
export async function revokeUserSessionKeys(userId: string): Promise<void> {
  if (!userId) return;
  await redisDelPattern(redisKeys.sessionPattern(userId));
  await redisDelPattern(redisKeys.userActivePattern(userId));
}

/**
 * Revokes a specific JWT token by its unique JWT ID (jti).
 */
export async function revokeToken(
  jti: string,
  ttlSeconds: number = DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
): Promise<void> {
  if (!jti) return;
  const key = `${REVOKED_TOKEN_PREFIX}${jti}`;
  await redisSet(key, "revoked", ttlSeconds);
}

/**
 * Checks if a JWT token has been revoked by its JWT ID (jti).
 */
export async function isTokenRevoked(jti?: string): Promise<boolean> {
  if (!jti) return false;
  const key = `${REVOKED_TOKEN_PREFIX}${jti}`;
  return redisExists(key);
}

/**
 * Revokes all sessions for a user by recording a revocation timestamp and deleting active session keys.
 */
export async function revokeAllUserSessions(
  userId: string,
  ttlSeconds: number = 7 * 24 * 60 * 60, // 7 days (max refresh token lifetime)
): Promise<void> {
  if (!userId) return;
  const key = `${USER_REVOKED_AT_PREFIX}${userId}`;
  const now = Date.now().toString();
  await redisSet(key, now, ttlSeconds);
  await revokeUserSessionKeys(userId);
}

/**
 * Evaluates whether a token issued at `issuedAtMs` falls at or before `revokedAtMs`.
 * Handles both millisecond-precise tokens (`iat_ms`) and standard second-aligned JWTs (`iat * 1000`).
 */
export function isTimestampRevoked(issuedAtMs: number, revokedAtMs: number): boolean {
  if (issuedAtMs <= 0 || revokedAtMs <= 0) return false;
  const isSecondAligned = issuedAtMs % 1000 === 0;
  if (isSecondAligned) {
    const revokedSec = Math.floor(revokedAtMs / 1000);
    const issuedSec = Math.floor(issuedAtMs / 1000);
    return issuedSec < revokedSec;
  }
  return issuedAtMs <= revokedAtMs;
}

/**
 * Checks if a token issued at `issuedAtMs` has been invalidated by a whole-user session revocation.
 */
export async function isUserSessionRevoked(userId?: string, issuedAtMs?: number): Promise<boolean> {
  if (!userId || !issuedAtMs) return false;
  const key = `${USER_REVOKED_AT_PREFIX}${userId}`;
  const revokedAtStr = await redisGet(key);
  if (!revokedAtStr) return false;
  const revokedAt = Number.parseInt(revokedAtStr, 10);
  return !Number.isNaN(revokedAt) && isTimestampRevoked(issuedAtMs, revokedAt);
}

/**
 * Halts all in-flight requests immediately for a tenant workspace.
 */
export async function blockTenant(tenantId: string): Promise<void> {
  if (!tenantId) return;
  const key = `${TENANT_BLOCKED_PREFIX}${tenantId.toLowerCase()}`;
  await redisSet(key, "blocked");
}

/**
 * Restores tenant workspace access.
 */
export async function unblockTenant(tenantId: string): Promise<void> {
  if (!tenantId) return;
  const key = `${TENANT_BLOCKED_PREFIX}${tenantId.toLowerCase()}`;
  await redisDel(key);
}

/**
 * Checks if a tenant workspace is currently blocked/suspended.
 */
export async function isTenantBlocked(tenantId?: string): Promise<boolean> {
  if (!tenantId) return false;
  const key = `${TENANT_BLOCKED_PREFIX}${tenantId.toLowerCase()}`;
  return redisExists(key);
}

export interface SessionRevocationCheck {
  tenantBlocked: boolean;
  tokenRevoked: boolean;
  userSessionRevoked: boolean;
}

export interface TenantAuthPipelineBatch {
  tenantBlocked: boolean;
  tokenRevoked: boolean;
  userSessionRevoked: boolean;
  globalSettingsCached: string | null;
  workspaceCached: string | null;
}

/**
 * Runs the three independent Redis revocation/blocklist reads used by the auth
 * hot path (tenant blocklist, token revocation, whole-user session revocation)
 * in a single pipelined round-trip instead of three sequential round-trips.
 * Semantics are identical to calling isTenantBlocked / isTokenRevoked /
 * isUserSessionRevoked individually.
 */
export async function checkSessionRevocationBatch(params: {
  tenant?: string;
  jti?: string;
  userId?: string;
  issuedAtMs?: number;
}): Promise<SessionRevocationCheck> {
  const ops: RedisBatchOp[] = [];
  const tenantKey = params.tenant ? `${TENANT_BLOCKED_PREFIX}${params.tenant.toLowerCase()}` : null;
  const jtiKey = params.jti ? `${REVOKED_TOKEN_PREFIX}${params.jti}` : null;
  const userKey = params.userId ? `${USER_REVOKED_AT_PREFIX}${params.userId}` : null;

  if (tenantKey) ops.push({ key: tenantKey, type: "exists" });
  if (jtiKey) ops.push({ key: jtiKey, type: "exists" });
  if (userKey) ops.push({ key: userKey, type: "get" });

  const results = await redisBatch(ops);
  let i = 0;
  const tenantBlocked = tenantKey ? (results[i++] as boolean) : false;
  const tokenRevoked = jtiKey ? (results[i++] as boolean) : false;
  const userRevokedAtStr = userKey ? (results[i] as string | null) : null;

  let userSessionRevoked = false;
  if (userRevokedAtStr && params.issuedAtMs) {
    const revokedAt = Number.parseInt(userRevokedAtStr, 10);
    userSessionRevoked =
      !Number.isNaN(revokedAt) && isTimestampRevoked(params.issuedAtMs, revokedAt);
  }

  return { tenantBlocked, tokenRevoked, userSessionRevoked };
}

/**
 * High-performance auth pipeline: batches revocation/blocklist reads along with
 * active user status, global settings, and workspace cache lookups into a single
 * Redis pipeline, collapsing up to 5 sequential network round-trips into 1.
 */
export async function checkTenantAuthPipelineBatch(params: {
  tenant?: string;
  jti?: string;
  userId?: string;
  role?: string;
  issuedAtMs?: number;
}): Promise<TenantAuthPipelineBatch> {
  const ops: RedisBatchOp[] = [];
  const tenantClean = params.tenant ? params.tenant.toLowerCase() : null;
  const tenantKey = tenantClean ? `${TENANT_BLOCKED_PREFIX}${tenantClean}` : null;
  const jtiKey = params.jti ? `${REVOKED_TOKEN_PREFIX}${params.jti}` : null;
  const userKey = params.userId ? `${USER_REVOKED_AT_PREFIX}${params.userId}` : null;
  const settingsKey = tenantClean ? redisKeys.globalSettings(tenantClean) : null;
  const workspaceKey = tenantClean ? redisKeys.workspace(tenantClean) : null;

  if (tenantKey) ops.push({ key: tenantKey, type: "exists" });
  if (jtiKey) ops.push({ key: jtiKey, type: "exists" });
  if (userKey) ops.push({ key: userKey, type: "get" });
  if (settingsKey) ops.push({ key: settingsKey, type: "get" });
  if (workspaceKey) ops.push({ key: workspaceKey, type: "get" });

  const results = await redisBatch(ops);
  let i = 0;
  const tenantBlocked = tenantKey ? (results[i++] as boolean) : false;
  const tokenRevoked = jtiKey ? (results[i++] as boolean) : false;
  const userRevokedAtStr = userKey ? (results[i++] as string | null) : null;
  const globalSettingsCached = settingsKey ? (results[i++] as string | null) : null;
  const workspaceCached = workspaceKey ? (results[i] as string | null) : null;

  let userSessionRevoked = false;
  if (userRevokedAtStr && params.issuedAtMs) {
    const revokedAt = Number.parseInt(userRevokedAtStr, 10);
    userSessionRevoked =
      !Number.isNaN(revokedAt) && isTimestampRevoked(params.issuedAtMs, revokedAt);
  }

  return {
    tenantBlocked,
    tokenRevoked,
    userSessionRevoked,
    globalSettingsCached,
    workspaceCached,
  };
}

import { randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { authArtifacts } from "../../db/schema.js";
import { activeDb } from "../../db/dbConnection.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";

export type AuthArtifactKind =
  | "handoff"
  | "two_factor_challenge"
  | "refresh_token"
  | "platform_setup"
  | "platform_password_reset"
  | "platform_two_factor_challenge"
  | "login_email_change"
  | "messaging_idempotency"
  | "tenant_user_invite"
  | "tenant_password_otp";

export interface AuthArtifactRecord<T> {
  id: string;
  kind: AuthArtifactKind;
  payload: T;
  expiresAt: Date;
}

export interface PutAuthArtifactOptions {
  id?: string;
  /** Opaque indexed lookup (refresh token hash). */
  lookupKey?: string | null;
  /** Indexed revoke scope (`user:{id}` or `ws:{subdomain}`). */
  scopeKey?: string | null;
}

function db() {
  return activeDb();
}

export function createArtifactId(): string {
  return randomBytes(24).toString("hex");
}

export function authArtifactUserScopeKey(userId: string): string {
  return `user:${userId}`;
}

export function authArtifactWorkspaceScopeKey(subdomain: string): string {
  return `ws:${subdomain.trim().toLowerCase()}`;
}

export async function putAuthArtifact<T>(
  kind: AuthArtifactKind,
  payload: T,
  ttlMs: number,
  idOrOptions: string | PutAuthArtifactOptions = {},
): Promise<string> {
  const options: PutAuthArtifactOptions =
    typeof idOrOptions === "string" ? { id: idOrOptions } : idOrOptions;
  const id = options.id ?? createArtifactId();
  const expiresAt = new Date(Date.now() + ttlMs);
  await db()
    .insert(authArtifacts)
    .values({
      id,
      kind,
      payload: payload as unknown as Record<string, unknown>,
      lookupKey: options.lookupKey ?? null,
      scopeKey: options.scopeKey ?? null,
      expiresAt,
    });
  return id;
}

/**
 * Inserts an artifact keyed by lookup_key. Returns claimed=false on unique conflict
 * so callers can load the winner’s payload instead of racing the side effect.
 */
export async function tryClaimAuthArtifactByLookupKey<T>(
  kind: AuthArtifactKind,
  payload: T,
  ttlMs: number,
  options: { lookupKey: string; scopeKey?: string | null },
): Promise<{ claimed: true; id: string } | { claimed: false }> {
  const id = createArtifactId();
  const expiresAt = new Date(Date.now() + ttlMs);
  try {
    await db()
      .insert(authArtifacts)
      .values({
        id,
        kind,
        payload: payload as unknown as Record<string, unknown>,
        lookupKey: options.lookupKey,
        scopeKey: options.scopeKey ?? null,
        expiresAt,
      });
    return { claimed: true, id };
  } catch (error) {
    if (isUniqueViolation(error)) return { claimed: false };
    throw error;
  }
}

/** Replaces the JSON payload for an existing artifact (e.g. finalize idempotency claim). */
export async function updateAuthArtifactPayload<T>(id: string, payload: T): Promise<void> {
  await db()
    .update(authArtifacts)
    .set({ payload: payload as unknown as Record<string, unknown> })
    .where(eq(authArtifacts.id, id));
}

export async function takeAuthArtifact<T>(
  id: string,
  kind: AuthArtifactKind,
): Promise<AuthArtifactRecord<T> | null> {
  const rows = await db()
    .select({
      id: authArtifacts.id,
      kind: authArtifacts.kind,
      payload: authArtifacts.payload,
      expiresAt: authArtifacts.expiresAt,
    })
    .from(authArtifacts)
    .where(eq(authArtifacts.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.kind !== kind) return null;

  await db().delete(authArtifacts).where(eq(authArtifacts.id, id));

  if (row.expiresAt.getTime() < Date.now()) return null;

  return {
    id: row.id,
    kind: row.kind as AuthArtifactKind,
    payload: row.payload as T,
    expiresAt: row.expiresAt,
  };
}

export async function getAuthArtifact<T>(
  id: string,
  kind: AuthArtifactKind,
): Promise<AuthArtifactRecord<T> | null> {
  const rows = await db()
    .select({
      id: authArtifacts.id,
      kind: authArtifacts.kind,
      payload: authArtifacts.payload,
      expiresAt: authArtifacts.expiresAt,
    })
    .from(authArtifacts)
    .where(eq(authArtifacts.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.kind !== kind) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db().delete(authArtifacts).where(eq(authArtifacts.id, id));
    return null;
  }
  return {
    id: row.id,
    kind: row.kind as AuthArtifactKind,
    payload: row.payload as T,
    expiresAt: row.expiresAt,
  };
}

/** Finds a non-expired artifact by kind + indexed lookup_key. */
export async function findAuthArtifactByLookupKey<T>(
  kind: AuthArtifactKind,
  lookupKey: string,
): Promise<AuthArtifactRecord<T> | null> {
  const rows = await db()
    .select({
      id: authArtifacts.id,
      kind: authArtifacts.kind,
      payload: authArtifacts.payload,
      expiresAt: authArtifacts.expiresAt,
    })
    .from(authArtifacts)
    .where(and(eq(authArtifacts.kind, kind), eq(authArtifacts.lookupKey, lookupKey)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db().delete(authArtifacts).where(eq(authArtifacts.id, row.id));
    return null;
  }
  return {
    id: row.id,
    kind: row.kind as AuthArtifactKind,
    payload: row.payload as T,
    expiresAt: row.expiresAt,
  };
}

export async function deleteAuthArtifact(id: string): Promise<void> {
  await db().delete(authArtifacts).where(eq(authArtifacts.id, id));
}

/**
 * Atomically consumes an artifact: `DELETE … WHERE id = ? AND kind = ? RETURNING`.
 *
 * Returns `true` only to the single caller that actually deleted the row. This
 * is the primitive that makes refresh-token rotation race-safe — two concurrent
 * refreshes presenting the same token both resolve the artifact id, but only
 * one wins the delete, so the loser cannot mint a second token pair.
 */
export async function consumeAuthArtifact(id: string, kind: AuthArtifactKind): Promise<boolean> {
  const rows = await db()
    .delete(authArtifacts)
    .where(and(eq(authArtifacts.id, id), eq(authArtifacts.kind, kind)))
    .returning({ id: authArtifacts.id });
  return rows.length > 0;
}

export async function purgeExpiredAuthArtifacts(): Promise<void> {
  await db().delete(authArtifacts).where(lt(authArtifacts.expiresAt, new Date()));
}

/** Finds a non-expired refresh-token artifact by its stored hash (indexed lookup_key). */
export async function findRefreshTokenByHash<T>(
  tokenHash: string,
): Promise<AuthArtifactRecord<T> | null> {
  const rows = await db()
    .select({
      id: authArtifacts.id,
      kind: authArtifacts.kind,
      payload: authArtifacts.payload,
      expiresAt: authArtifacts.expiresAt,
    })
    .from(authArtifacts)
    .where(and(eq(authArtifacts.kind, "refresh_token"), eq(authArtifacts.lookupKey, tokenHash)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    // Legacy rows written before lookup_key existed — fall back once.
    const legacy = await db()
      .select({
        id: authArtifacts.id,
        kind: authArtifacts.kind,
        payload: authArtifacts.payload,
        expiresAt: authArtifacts.expiresAt,
      })
      .from(authArtifacts)
      .where(eq(authArtifacts.kind, "refresh_token"));
    for (const candidate of legacy) {
      if (candidate.expiresAt.getTime() < Date.now()) continue;
      const payload = candidate.payload as T & { tokenHash?: string };
      if (payload.tokenHash === tokenHash) {
        return {
          id: candidate.id,
          kind: candidate.kind as AuthArtifactKind,
          payload: payload as T,
          expiresAt: candidate.expiresAt,
        };
      }
    }
    return null;
  }

  if (row.expiresAt.getTime() < Date.now()) {
    await db().delete(authArtifacts).where(eq(authArtifacts.id, row.id));
    return null;
  }

  return {
    id: row.id,
    kind: row.kind as AuthArtifactKind,
    payload: row.payload as T,
    expiresAt: row.expiresAt,
  };
}

/** Revokes all refresh-token sessions for a workspace user (e.g. after login email change). */
export async function deleteRefreshTokensForUser(userId: string): Promise<void> {
  await db()
    .delete(authArtifacts)
    .where(
      and(
        eq(authArtifacts.kind, "refresh_token"),
        eq(authArtifacts.scopeKey, authArtifactUserScopeKey(userId)),
      ),
    );

  // Legacy rows without scope_key.
  const legacy = await db()
    .select({
      id: authArtifacts.id,
      payload: authArtifacts.payload,
    })
    .from(authArtifacts)
    .where(eq(authArtifacts.kind, "refresh_token"));
  for (const row of legacy) {
    const payload = row.payload as { userId?: string };
    if (payload.userId === userId) {
      await db().delete(authArtifacts).where(eq(authArtifacts.id, row.id));
    }
  }
}

/** Deletes all authentication and session artifacts associated with a workspace subdomain. */
export async function deleteAuthArtifactsForWorkspace(subdomain: string): Promise<void> {
  const scopeKey = authArtifactWorkspaceScopeKey(subdomain);
  await db().delete(authArtifacts).where(eq(authArtifacts.scopeKey, scopeKey));

  // Legacy rows without scope_key.
  const normalized = subdomain.trim().toLowerCase();
  const rows = await db()
    .select({
      id: authArtifacts.id,
      payload: authArtifacts.payload,
    })
    .from(authArtifacts);
  for (const row of rows) {
    try {
      const payload = row.payload as Record<string, unknown>;
      const userObj =
        payload.user && typeof payload.user === "object"
          ? (payload.user as Record<string, unknown>)
          : null;
      if (
        payload.workspaceSubdomain === normalized ||
        payload.subdomain === normalized ||
        (userObj && userObj.workspaceSubdomain === normalized)
      ) {
        await db().delete(authArtifacts).where(eq(authArtifacts.id, row.id));
      }
    } catch {
      // ignore invalid JSON payloads
    }
  }
}

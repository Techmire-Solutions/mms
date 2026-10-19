import { and, eq } from "drizzle-orm";
import { authArtifacts } from "../schema.js";
import { activeDb } from "../dbConnection.js";
import {
  authArtifactUserScopeKey,
  authArtifactWorkspaceScopeKey,
  type AuthArtifactKind,
  type AuthArtifactRecord,
} from "../../services/auth/authArtifactService.js";

function db() {
  return activeDb();
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

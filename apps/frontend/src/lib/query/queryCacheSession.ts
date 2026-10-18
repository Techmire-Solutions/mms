import type { User } from "@mms/shared";

const SESSION_KEY = "mms_query_cache_session_v2";
interface CacheSession {
  identity: string;
  key: string;
}

export function readQueryCacheSession(): CacheSession | undefined {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    if (
      value &&
      typeof value === "object" &&
      "identity" in value &&
      "key" in value &&
      typeof value.identity === "string" &&
      typeof value.key === "string" &&
      value.key.startsWith("mms_query_cache_v2:")
    ) {
      return { identity: value.identity, key: value.key };
    }
  } catch {
    // Unavailable storage disables persistence, not the verified session.
  }
  return undefined;
}

export function tenantCacheIdentity(user: User): string {
  return JSON.stringify([
    user.workspaceSubdomain,
    user.id,
    user.role,
    Boolean(user.mustChangePassword),
  ]);
}

export function resolveQueryCacheSession(identity: string): CacheSession | undefined {
  try {
    const current = readQueryCacheSession();
    if (current?.identity === identity) return current;
    const next = { identity, key: `mms_query_cache_v2:${crypto.randomUUID()}` };
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    return next;
  } catch {
    return undefined;
  }
}

export function revokeQueryCacheSession(key: string | undefined): void {
  try {
    if (key && readQueryCacheSession()?.key === key) localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage may be blocked; in-memory state is still cleared by the caller.
  }
}

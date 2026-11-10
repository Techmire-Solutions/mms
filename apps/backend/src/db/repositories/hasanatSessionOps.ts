/**
 * Academic-session lookups used by the Hasanat write guards.
 *
 * Split from `hasanatCardOps` to keep the module inside the 300-line ceiling; re-exported there so
 * callers keep importing from one place.
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import { sessionClasses, sessions } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

/** Status of the given academic sessions (`null` for missing ids), one query. */
export async function findSessionStatuses(
  tenant: string,
  sessionIds: readonly string[],
): Promise<Map<string, string | null>> {
  const ids = Array.from(new Set(sessionIds.filter(Boolean)));
  const result = new Map<string, string | null>();
  if (ids.length === 0) return result;

  const subdomain = tenant.trim().toLowerCase();
  await withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: sessions.id, status: sessions.status })
      .from(sessions)
      .where(
        and(
          eq(sessions.workspaceSubdomain, subdomain),
          inArray(sessions.id, ids),
          isNull(sessions.deletedAt),
        ),
      );
    for (const row of rows) result.set(row.id, row.status);
  });

  return result;
}

/** Session that owns a class (`session_classes.id` → `session_id`), for pre-insert checks. */
export async function findSessionIdForClass(
  tenant: string,
  classId: string,
): Promise<string | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ sessionId: sessionClasses.sessionId })
      .from(sessionClasses)
      .where(and(eq(sessionClasses.workspaceSubdomain, subdomain), eq(sessionClasses.id, classId)))
      .limit(1);
    return rows[0]?.sessionId ?? null;
  });
}

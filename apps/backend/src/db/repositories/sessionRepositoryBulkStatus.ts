import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { canTransitionSession, dedupeTrimmedIds } from "@mms/shared";
import { sessions } from "../schema.js";
import { withTenant } from "../tenant-context.js";

/**
 * Set typed `status` for active sessions in one UPDATE.
 *
 * The lifecycle guard is re-evaluated **under a row lock** here, not only in the use case: the
 * caller's earlier read is advisory, so two concurrent bulk transitions can no longer both pass a
 * stale `canTransitionSession` and let the last writer win.
 */
export async function bulkUpdateSessionsStatusSql(
  workspaceSubdomain: string,
  ids: string[],
  status: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (!subdomain || uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const normalizedStatus = status.trim().toLowerCase() || "active";

  return withTenant(subdomain, async (tx) => {
    const stored = await tx
      .select({ id: sessions.id, status: sessions.status })
      .from(sessions)
      .where(
        and(
          eq(sessions.workspaceSubdomain, subdomain),
          inArray(sessions.id, uniqueIds),
          isNull(sessions.deletedAt),
        ),
      )
      .for("update");

    const allowed = stored.filter((row) => canTransitionSession(String(row.status), normalizedStatus));
    if (allowed.length === 0) return { succeeded: 0, failed: uniqueIds.length };
    // Rows that had a live transition at read time; a concurrent writer changing status again will
    // no longer match this predicate (READ COMMITTED re-checks the row after the lock is granted).
    const fromStatuses = [...new Set(allowed.map((row) => String(row.status)))];

    const updated = await tx
      .update(sessions)
      .set({
        status: normalizedStatus,
        updatedAt: new Date(),
        version: sql`${sessions.version} + 1`,
      })
      .where(
        and(
          eq(sessions.workspaceSubdomain, subdomain),
          inArray(
            sessions.id,
            allowed.map((row) => row.id),
          ),
          inArray(sessions.status, fromStatuses),
          isNull(sessions.deletedAt),
        ),
      )
      .returning({ id: sessions.id });

    const succeeded = updated.length;
    const failed = Math.max(0, uniqueIds.length - succeeded);
    return { succeeded, failed };
  });
}

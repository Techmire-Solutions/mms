import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { messageLogs } from "../schema.js";
import { withTenant } from "../tenant-context.js";

/** Soft-archives active message logs for a workspace in one tenant-scoped update. */
export async function softDeleteActiveMessageLogs(workspaceSubdomain: string): Promise<void> {
  const subdomain = workspaceSubdomain?.trim().toLowerCase();
  if (!subdomain) return;
  await withTenant(subdomain, async (tx) => {
    await tx
      .update(messageLogs)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(messageLogs.workspaceSubdomain, subdomain), isNull(messageLogs.deletedAt)));
  });
}

/**
 * Restores soft-archived message logs for a workspace with actor attribution.
 *
 * `ids` restores only archived logs with a matching id; `null` restores every
 * archived log in the workspace. Returns the number of rows restored (hard count
 * from `RETURNING` — no projections).
 */
export async function restoreArchivedMessageLog(
  workspaceSubdomain: string,
  userId: string,
  ids: string[] | null,
): Promise<number> {
  const subdomain = workspaceSubdomain?.trim().toLowerCase();
  if (!subdomain) return 0;
  const cleanIds = (ids ?? []).map((id) => id.trim()).filter((id) => id.length > 0);
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const conditions = [
      eq(messageLogs.workspaceSubdomain, subdomain),
      isNotNull(messageLogs.deletedAt),
    ];
    if (cleanIds.length > 0) {
      conditions.push(inArray(messageLogs.id, cleanIds));
    }
    const restored = await tx
      .update(messageLogs)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        restoredAt: now,
        restoredBy: userId,
        updatedAt: now,
      })
      .where(and(...conditions))
      .returning({ id: messageLogs.id });
    return restored.length;
  });
}

import { and, eq, isNull, or } from "drizzle-orm";
import { accountingEntries } from "../schema.js";
import { withTenant } from "../tenant-context.js";

/**
 * Active entry that already reverses the original, whether posted through the
 * reversal endpoint (`source_type = 'reversal'`, `source_id = originalId`) or by
 * the legacy client path (only `reversed_ref = originalRef`).
 */
export async function findActiveReversalOf(
  tenant: string,
  original: { id: string; ref: string },
): Promise<{ id: string; ref: string } | null> {
  const subdomain = tenant.trim().toLowerCase();
  const bySource = and(
    eq(accountingEntries.sourceType, "reversal"),
    eq(accountingEntries.sourceId, original.id),
  );
  const ref = original.ref.trim();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: accountingEntries.id, ref: accountingEntries.ref })
      .from(accountingEntries)
      .where(
        and(
          eq(accountingEntries.workspaceSubdomain, subdomain),
          isNull(accountingEntries.deletedAt),
          ref ? or(bySource, eq(accountingEntries.reversedRef, ref)) : bySource,
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

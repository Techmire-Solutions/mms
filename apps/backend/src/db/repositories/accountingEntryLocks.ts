import { sql } from "drizzle-orm";
import { dedupeTrimmedIds } from "@mms/shared";
import { withTenant } from "../tenant-context.js";

/** Call inside the write transaction, before reading the entries being changed. */
export async function lockJournalEntries(tenant: string, ids: string[]): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const keys = dedupeTrimmedIds(ids).map((id) =>
    JSON.stringify(["accounting-entry", subdomain, id]),
  );
  if (keys.length === 0) return;
  await withTenant(subdomain, async (tx) => {
    // Advisory locks also cover IDs that do not exist yet. Sort the lock keys
    // in SQL so overlapping batches acquire them in the same order.
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(lock_key)
      FROM (
        SELECT DISTINCT hashtextextended(key, 0) AS lock_key
        FROM unnest(ARRAY[${sql.join(
          keys.map((key) => sql`${key}`),
          sql`, `,
        )}]::text[]) AS keys(key)
        ORDER BY lock_key
      ) AS ordered_keys
    `);
  });
}

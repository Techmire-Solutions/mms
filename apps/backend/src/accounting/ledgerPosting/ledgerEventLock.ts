import { sql } from "drizzle-orm";
import { withTenant } from "../../db/tenant-context.js";

/**
 * Serialises one ledger event (a revaluation, restatement, hedge valuation,
 * settlement or reclassification) for a tenant.
 *
 * These operations are "one per date" by design: a repeat must return the stored
 * result instead of posting again. Checking for an existing run is a
 * read-then-insert, so two concurrent requests both pass the check; the unique
 * index then rejects the loser *after* its journal entries are written, which
 * aborts the caller's whole transaction. Taking this lock first makes the second
 * request wait, then see the committed result — the idempotent behaviour the API
 * documents.
 *
 * The key is scoped per event so unrelated events do not serialise. Re-acquiring
 * the lock in the same transaction is a no-op.
 */
export async function lockLedgerEvent(tenant: string, eventKey: string): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  if (!subdomain || !eventKey) return;
  await withTenant(subdomain, async (tx) => {
    if (typeof tx.execute !== "function") return;
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`ledger-event:${subdomain}:${eventKey}`}))`,
    );
  });
}

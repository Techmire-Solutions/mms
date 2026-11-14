import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { beginLongLivedTenantTransaction } from "../../db/dbTransactions.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant, withTenantRead } from "../../db/tenant-context.js";
import {
  contacts,
  mujtahidReps,
  mujtahids,
  obligationCollections,
  obligationTypes,
  workspaces,
} from "../../db/schema.js";
import type { ObligationCollection } from "@mms/shared";
import {
  bulkSaveObligationCollections,
  saveObligationCollection,
} from "../../db/repositories/obligationCollectionsPersist.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Optimistic concurrency under real contention.
 *
 * `obligationsPersistenceDb` proves a **stale** token is rejected in sequence. That passes even if
 * the guard were `>=` instead of `=`, or if the upsert stopped bumping `version` — it never has two
 * writers. These tests race two pooled connections against one row, which is the only way to prove
 * the lost-update protection the OCC token exists for (test-suite audit G1).
 */

const TENANT = `obl-conc-${randomUUID().slice(0, 8)}`;
const RECEIPT_ID = "oc-conc-1";

function receipt(overrides: Partial<ObligationCollection> = {}): ObligationCollection {
  return {
    id: RECEIPT_ID,
    receipt_no: "REC-CONC-1",
    received_date: "2026-10-24",
    sender_id: "cnt-conc",
    amount: 1000,
    currency_id: "PKR",
    payment_mode: "Cash",
    obligation_type_id: "ot-conc",
    mujtahid_representative_id: "rep-conc",
    received_by: "u-admin",
    ...overrides,
  } as ObligationCollection;
}

async function readReceipt() {
  return withTenantRead(TENANT, async (tx) => {
    const rows = await tx
      .select()
      .from(obligationCollections)
      .where(
        and(
          eq(obligationCollections.workspaceSubdomain, TENANT),
          eq(obligationCollections.id, RECEIPT_ID),
        ),
      );
    return rows[0] ?? null;
  });
}

/** Seeds the receipt with no token (the legacy last-write-wins path) and returns its version. */
async function seedReceipt(): Promise<number> {
  // The soft-delete trigger refuses a hard delete unless the purge GUC is set for the tx.
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx
      .delete(obligationCollections)
      .where(eq(obligationCollections.workspaceSubdomain, TENANT));
  });
  await saveObligationCollection(TENANT, receipt());
  const row = await readReceipt();
  return Number(row?.version ?? 0);
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await withGlobalTenant(async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Concurrency" })
      .onConflictDoNothing();
  });
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(contacts)
      .values({
        id: "cnt-conc",
        workspaceSubdomain: TENANT,
        firstName: "Conc",
        name: "Conc Sender",
      })
      .onConflictDoNothing();
    await tx
      .insert(obligationTypes)
      .values({ id: "ot-conc", workspaceSubdomain: TENANT, name: "Khums" })
      .onConflictDoNothing();
    await tx
      .insert(mujtahids)
      .values({ id: "mj-conc", workspaceSubdomain: TENANT, name: "Mujtahid" })
      .onConflictDoNothing();
    await tx
      .insert(mujtahidReps)
      .values({
        id: "rep-conc",
        workspaceSubdomain: TENANT,
        mujtahidId: "mj-conc",
        name: "Representative",
      })
      .onConflictDoNothing();
  });
}, 120_000);

afterAll(async () => {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx
      .delete(obligationCollections)
      .where(eq(obligationCollections.workspaceSubdomain, TENANT));
    await tx.delete(mujtahidReps).where(eq(mujtahidReps.workspaceSubdomain, TENANT));
    await tx.delete(mujtahids).where(eq(mujtahids.workspaceSubdomain, TENANT));
    await tx.delete(obligationTypes).where(eq(obligationTypes.workspaceSubdomain, TENANT));
    await tx.delete(contacts).where(eq(contacts.workspaceSubdomain, TENANT));
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  }).catch(() => undefined);
  await closeDatabase();
});

describe("obligation receipt concurrency", () => {
  beforeEach(async () => {
    await seedReceipt();
  });

  it("lets exactly one of two same-version saves win and rejects the other with 409", async () => {
    const version = await seedReceipt();

    const results = await Promise.allSettled([
      saveObligationCollection(TENANT, receipt({ amount: 1111, version })),
      saveObligationCollection(TENANT, receipt({ amount: 2222, version })),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toMatchObject({ statusCode: 409, type: "stale_write" });

    // The stored row is the winner's value, and exactly one version bump happened.
    const stored = await readReceipt();
    const winner = results[0]!.status === "fulfilled" ? 1111 : 2222;
    expect(Number(stored?.amount)).toBe(winner);
    expect(Number(stored?.version)).toBe(version + 1);
  });

  it("refuses a blind overwrite with a token that is one behind", async () => {
    const version = await seedReceipt();
    await saveObligationCollection(TENANT, receipt({ amount: 1500, version }));

    await expect(
      saveObligationCollection(TENANT, receipt({ amount: 9999, version })),
    ).rejects.toMatchObject({ statusCode: 409, type: "stale_write" });

    const stored = await readReceipt();
    expect(Number(stored?.amount)).toBe(1500);
    expect(Number(stored?.version)).toBe(version + 1);
  });

  it("serializes on the row lock and re-checks the version predicate", async () => {
    const version = await seedReceipt();
    const writer = await beginLongLivedTenantTransaction(TENANT);
    const challenger = await beginLongLivedTenantTransaction(TENANT);
    try {
      // A holds an uncommitted update on the row.
      const first = await writer.tx
        .update(obligationCollections)
        .set({ amount: "3000.00", version: sql`${obligationCollections.version} + 1` })
        .where(
          and(
            eq(obligationCollections.workspaceSubdomain, TENANT),
            eq(obligationCollections.id, RECEIPT_ID),
            eq(obligationCollections.version, version),
          ),
        )
        .returning({ id: obligationCollections.id });
      expect(first).toHaveLength(1);

      // B's guarded update must block on the lock, then affect nothing once A commits.
      const challenge = challenger.tx
        .update(obligationCollections)
        .set({ amount: "4000.00", version: sql`${obligationCollections.version} + 1` })
        .where(
          and(
            eq(obligationCollections.workspaceSubdomain, TENANT),
            eq(obligationCollections.id, RECEIPT_ID),
            eq(obligationCollections.version, version),
          ),
        )
        .returning({ id: obligationCollections.id });

      await writer.commit();
      const second = await challenge;
      await challenger.commit();

      expect(second).toHaveLength(0);
    } finally {
      await writer.commit().catch(() => undefined);
      await challenger.commit().catch(() => undefined);
    }

    const stored = await readReceipt();
    expect(Number(stored?.amount)).toBe(3000);
    expect(Number(stored?.version)).toBe(version + 1);
  });

  it("arbitrates a race between the single save and the bulk save", async () => {
    const version = await seedReceipt();

    const results = await Promise.allSettled([
      saveObligationCollection(TENANT, receipt({ amount: 5100, version })),
      bulkSaveObligationCollections(TENANT, [receipt({ amount: 6200, version })]),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const stored = await readReceipt();
    expect(Number(stored?.version)).toBe(version + 1);
  });
});

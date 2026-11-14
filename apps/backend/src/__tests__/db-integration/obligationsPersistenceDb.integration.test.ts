import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  contacts,
  mujtahidReps,
  mujtahids,
  obligationCollections,
  obligationDistributions,
  obligationTypes,
  wakalaTypes,
  workspaces,
} from "../../db/schema.js";
import type { ObligationCollection } from "@mms/shared";
import { requireDatabaseConnection } from "./dbTestSupport.js";
import {
  bulkRestoreObligationCollections,
  bulkSaveObligationCollections,
  saveObligationCollection,
} from "../../db/repositories/obligationCollectionsPersist.js";
import { replaceWakalaAggregateForWorkspace } from "../../db/repositories/obligationWakalaRepository.js";

/**
 * Persistence invariants of the obligations module that cannot be proven with mocks:
 * optimistic concurrency, the "a save must not archive or resurrect" rule, and restore
 * provenance. See docs/obligations-schema-persistence-audit-2026-11-14.md (F14, F15).
 */
const tenant = "obligations-persistence-db";
let available = false;

function collectionFixture(overrides: Partial<ObligationCollection> = {}): ObligationCollection {
  return {
    id: "oc-persist-1",
    receipt_no: "REC-PERSIST-1",
    received_date: "2026-06-15",
    sender_id: "contact-persist-1",
    amount: 1500.25,
    currency_id: "pkr",
    payment_mode: "Cash",
    obligation_type_id: "ot-persist-1",
    mujtahid_representative_id: "rep-persist-1",
    received_by: "usr-1",
    ...overrides,
  };
}

async function seedCatalogue(): Promise<void> {
  await withTenant(tenant, async (tx) => {
    await tx.insert(contacts).values({
      id: "contact-persist-1",
      workspaceSubdomain: tenant,
      firstName: "Donor",
      name: "Donor One",
    });
    await tx
      .insert(obligationTypes)
      .values({ id: "ot-persist-1", workspaceSubdomain: tenant, name: "Khums" });
    // Migration 0258 added the composite FKs a receipt must satisfy: a real sender, and a
    // (mujtahid, representative) pair. Without these this suite fails on the constraints before it
    // can reach the invariants it exists to prove.
    await tx
      .insert(mujtahids)
      .values({ id: "mj-persist-1", workspaceSubdomain: tenant, name: "Ayatullah Persist" });
    await tx.insert(mujtahidReps).values({
      id: "rep-persist-1",
      workspaceSubdomain: tenant,
      mujtahidId: "mj-persist-1",
      name: "Rep Persist",
    });
  });
}

async function truncateCollections(): Promise<void> {
  await withTenant(tenant, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx
      .delete(obligationCollections)
      .where(eq(obligationCollections.workspaceSubdomain, tenant));
  });
}

async function readRow() {
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select()
      .from(obligationCollections)
      .where(
        and(
          eq(obligationCollections.workspaceSubdomain, tenant),
          eq(obligationCollections.id, "oc-persist-1"),
        ),
      );
    return rows[0] ?? null;
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  available = true;
  await withTenant(tenant, async (tx) => {
    await tx.insert(workspaces).values({
      id: tenant,
      subdomain: tenant,
      madrasaName: "Obligations persistence test",
      enabled: true,
    });
  });
  await seedCatalogue();
});

beforeEach(async () => {
  await truncateCollections();
});

afterAll(async () => {
  try {
    if (available) {
      await withTenant(tenant, async (tx) => {
        await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
        await tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
      });
    }
  } finally {
    await closeDatabase();
  }
});

describe("obligations collections persistence (Postgres)", () => {
  it("stores a 2-dp amount exactly and starts the version at 1", async () => {
    await saveObligationCollection(tenant, collectionFixture());

    const row = await readRow();
    expect(row?.amount).toBe("1500.25");
    expect(row?.version).toBe(1);
  });

  it("rejects a save carrying a stale version instead of overwriting the winner", async () => {
    await saveObligationCollection(tenant, collectionFixture());

    // First edit wins and bumps the version.
    await saveObligationCollection(tenant, collectionFixture({ amount: 2000, version: 1 }));
    expect((await readRow())?.version).toBe(2);

    // Second edit still holds version 1 — it must fail loudly, not clobber 2000.
    await expect(
      saveObligationCollection(tenant, collectionFixture({ amount: 9000, version: 1 })),
    ).rejects.toThrow(/changed by someone else/);
    expect((await readRow())?.amount).toBe("2000.00");
  });

  it("keeps a token-less save on the legacy last-write-wins path", async () => {
    await saveObligationCollection(tenant, collectionFixture());
    await saveObligationCollection(tenant, collectionFixture({ amount: 2000 }));

    const row = await readRow();
    expect(row?.amount).toBe("2000.00");
    expect(row?.version).toBe(2);
  });

  it("refuses to clear deleted_at through a bulk save (no silent resurrection)", async () => {
    // Archive the row the way the delete endpoint does.
    await saveObligationCollection(tenant, collectionFixture());
    await withTenant(tenant, (tx) =>
      tx
        .update(obligationCollections)
        .set({ deletedAt: new Date("2026-07-01T00:00:00.000Z"), deletedBy: "usr-1" })
        .where(eq(obligationCollections.id, "oc-persist-1")),
    );

    // A stale/offline client re-syncs the record with `deletedAt: null`.
    await bulkSaveObligationCollections(tenant, [collectionFixture({ amount: 2100 })]);

    const row = await readRow();
    expect(row?.deletedAt).not.toBeNull();
    expect(row?.amount).toBe("2100.00");
  });

  it("stamps restore provenance and bumps the version on restore", async () => {
    await saveObligationCollection(tenant, collectionFixture());
    await withTenant(tenant, (tx) =>
      tx
        .update(obligationCollections)
        .set({ deletedAt: new Date("2026-07-01T00:00:00.000Z"), deletedBy: "usr-1" })
        .where(eq(obligationCollections.id, "oc-persist-1")),
    );

    const result = await bulkRestoreObligationCollections(tenant, ["oc-persist-1"], "usr-2");
    expect(result).toEqual({ succeeded: 1, failed: 0 });

    const row = await readRow();
    expect(row?.deletedAt).toBeNull();
    expect(row?.deletedBy).toBeNull();
    expect(row?.restoredAt).toBeInstanceOf(Date);
    expect(row?.restoredBy).toBe("usr-2");
    expect(row?.version).toBe(2);
  });

  it("writes a wakala and its rules in one transaction", async () => {
    // A distribution that violates the account FK must roll the wakala insert back with it.
    await expect(
      replaceWakalaAggregateForWorkspace(
        tenant,
        [
          {
            id: "wt-atomic",
            mujtahid_representative_id: "rep-persist-1",
            obligation_type_id: "ot-persist-1",
          },
        ],
        [
          {
            id: "od-atomic",
            name: "Sahm Imam",
            percentage: 60,
            wakala_type_id: "wt-atomic",
            type: "Income",
            account_id: "account-that-does-not-exist",
          },
        ],
      ),
    ).rejects.toThrow();

    const rows = await withTenant(tenant, (tx) =>
      tx.select({ id: wakalaTypes.id }).from(wakalaTypes).where(eq(wakalaTypes.id, "wt-atomic")),
    );
    expect(rows).toHaveLength(0);
  });

  it("rejects a distribution whose account is not in the chart", async () => {
    await withTenant(tenant, (tx) =>
      tx.insert(wakalaTypes).values({
        id: "wt-persist-1",
        workspaceSubdomain: tenant,
        mujtahidRepresentativeId: "rep-persist-1",
        obligationTypeId: "ot-persist-1",
      }),
    );

    await expect(
      withTenant(tenant, (tx) =>
        tx.insert(obligationDistributions).values({
          id: "od-persist-1",
          workspaceSubdomain: tenant,
          name: "Sahm Imam",
          percentage: "40",
          wakalaTypeId: "wt-persist-1",
          type: "Income",
          accountId: "account-that-does-not-exist",
        }),
      ),
    ).rejects.toThrow();
  });

  it("enforces the same closed vocabularies the shared schemas declare", async () => {
    // The shared tuples and these CHECK constraints are two copies of one vocabulary; the DTOs
    // derive from the tuples, so a divergence here means a client could accept what the database
    // refuses (audit S2/C1).
    await truncateCollections();
    await expect(
      withTenant(tenant, (tx) =>
        tx.insert(obligationCollections).values({
          id: "oc-bad-mode",
          workspaceSubdomain: tenant,
          receiptNo: "REC-BAD-MODE",
          receivedDate: "2026-10-24",
          senderId: "contact-persist-1",
          amount: "10.00",
          currencyId: "pkr",
          // Not in OBLIGATION_PAYMENT_MODES.
          paymentMode: "Cheque",
          obligationTypeId: "ot-persist-1",
          mujtahidRepresentativeId: "rep-persist-1",
          receivedBy: "u-admin",
        }),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(tenant, (tx) =>
        tx.insert(obligationCollections).values({
          id: "oc-bad-date",
          workspaceSubdomain: tenant,
          receiptNo: "REC-BAD-DATE",
          // Not a calendar date: the DTO rejects this shape before it is sent.
          receivedDate: "24/10/2026",
          senderId: "contact-persist-1",
          amount: "10.00",
          currencyId: "pkr",
          paymentMode: "Cash",
          obligationTypeId: "ot-persist-1",
          mujtahidRepresentativeId: "rep-persist-1",
          receivedBy: "u-admin",
        }),
      ),
    ).rejects.toThrow();
  });
});

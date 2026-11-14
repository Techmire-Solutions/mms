import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
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
import { saveObligationCollection } from "../../db/repositories/obligationCollectionsPersist.js";
import { countCatalogueDependents } from "../../db/repositories/obligationCatalogueDependentsRepository.js";
import { obligationsRepository } from "../../obligations/repository/obligationsRepositoryAdapter.js";
import { createObligationsCatalogUseCases } from "../../obligations/use-cases/obligationsCatalogUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * What archiving the *parents* of a receipt must and must not do.
 *
 * A receipt is a financial document: archiving the contact who paid (or the representative who
 * received it) must leave the receipt intact and readable, and a hard delete of a parent must be
 * refused by the RESTRICT foreign keys added in migration 0258 — not silently cascade the receipt
 * away. Nothing covered this before (test-suite audit G3).
 */

const TENANT = `obl-cascade-${randomUUID().slice(0, 8)}`;

function receipt(): ObligationCollection {
  return {
    id: "oc-cascade-1",
    receipt_no: "REC-CASCADE-1",
    received_date: "2026-10-24",
    sender_id: "cnt-cascade",
    amount: 750,
    currency_id: "PKR",
    payment_mode: "Cash",
    obligation_type_id: "ot-cascade",
    mujtahid_representative_id: "rep-cascade",
    received_by: "u-admin",
  } as ObligationCollection;
}

async function receiptCount(): Promise<number> {
  return withTenantRead(TENANT, async (tx) => {
    const rows = await tx
      .select({ id: obligationCollections.id })
      .from(obligationCollections)
      .where(and(eq(obligationCollections.workspaceSubdomain, TENANT)));
    return rows.length;
  });
}

/** Soft-deletes a contact the way the contacts module does (archive columns only). */
async function archiveContact(): Promise<void> {
  await withTenant(TENANT, (tx) =>
    tx
      .update(contacts)
      .set({
        deletedAt: new Date(),
        deletedBy: "u-admin",
        deletionReason: "Merged duplicate",
      })
      .where(and(eq(contacts.workspaceSubdomain, TENANT), eq(contacts.id, "cnt-cascade"))),
  );
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await withGlobalTenant(async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Cascade" })
      .onConflictDoNothing();
  });
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(contacts)
      .values({
        id: "cnt-cascade",
        workspaceSubdomain: TENANT,
        firstName: "Cascade",
        name: "Cascade Sender",
      })
      .onConflictDoNothing();
    await tx
      .insert(obligationTypes)
      .values({ id: "ot-cascade", workspaceSubdomain: TENANT, name: "Khums" })
      .onConflictDoNothing();
    await tx
      .insert(mujtahids)
      .values({ id: "mj-cascade", workspaceSubdomain: TENANT, name: "Mujtahid" })
      .onConflictDoNothing();
    await tx
      .insert(mujtahidReps)
      .values({
        id: "rep-cascade",
        workspaceSubdomain: TENANT,
        mujtahidId: "mj-cascade",
        name: "Representative",
      })
      .onConflictDoNothing();
  });
  await saveObligationCollection(TENANT, receipt());
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
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(contacts).where(eq(contacts.workspaceSubdomain, TENANT));
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  }).catch(() => undefined);
  await closeDatabase();
});

describe("obligation receipt parent lifecycle", () => {
  it("keeps the receipt when the contributing contact is archived", async () => {
    expect(await receiptCount()).toBe(1);

    await archiveContact();

    // Archiving a contact is a contacts-module concern; the financial record must not disappear.
    expect(await receiptCount()).toBe(1);
  });

  it("refuses to hard-delete a contact that a receipt still references", async () => {
    // RESTRICT (0258): a cascade here would silently destroy a posted receipt.
    await expect(
      withTenant(TENANT, (tx) =>
        tx
          .execute(sql`SET LOCAL app.allow_hard_purge = 'true'`)
          .then(() => tx.delete(contacts).where(eq(contacts.id, "cnt-cascade"))),
      ),
    ).rejects.toThrow();

    expect(await receiptCount()).toBe(1);
  });

  it("pins the FK delete actions: sender RESTRICT, representative/type CASCADE", async () => {
    // The application guard is the only thing standing between a catalogue replace and a deleted
    // receipt: the receipt FKs to reps and types are ON DELETE CASCADE, unlike the sender edge.
    const actions = await withTenantRead(TENANT, async (tx) => {
      const result = await tx.execute(sql`
        SELECT conname, confdeltype
          FROM pg_constraint
         WHERE conrelid = 'obligation_collections'::regclass
           AND contype = 'f'
           AND conname LIKE 'obligation_collections_%'
      `);
      return result.rows as Array<{ conname: string; confdeltype: string }>;
    });
    const byName = new Map(actions.map((row) => [row.conname, row.confdeltype]));
    expect(byName.get("obligation_collections_sender_fk")).toBe("r");
    expect(byName.get("obligation_collections_rep_fk")).toBe("c");
    expect(byName.get("obligation_collections_obligation_type_fk")).toBe("c");
  });

  it("counts a receipt as a cascade dependent of its representative", async () => {
    const dependents = await countCatalogueDependents(TENANT, "representative", ["rep-cascade"]);
    expect(dependents.receipts).toBe(1);
  });

  it("counts a receipt as a cascade dependent of its obligation type", async () => {
    const dependents = await countCatalogueDependents(TENANT, "obligationType", ["ot-cascade"]);
    expect(dependents.receipts).toBe(1);
  });

  it("refuses a representative replace that would cascade the receipt away", async () => {
    // This is the real defence: without it the CASCADE above deletes posted receipts silently.
    const catalog = createObligationsCatalogUseCases(obligationsRepository);
    await expect(
      runWithTenant(TENANT, () => catalog.replaceMujtahidReps([])),
    ).rejects.toMatchObject({ statusCode: 409, type: "catalogue_in_use" });
    expect(await receiptCount()).toBe(1);
  });

  it("refuses an obligation-type replace that would cascade the receipt away", async () => {
    const catalog = createObligationsCatalogUseCases(obligationsRepository);
    await expect(
      runWithTenant(TENANT, () => catalog.replaceObligationTypes([])),
    ).rejects.toMatchObject({ statusCode: 409, type: "catalogue_in_use" });
    expect(await receiptCount()).toBe(1);
  });

  it("keeps the receipt readable while its contact is archived", async () => {
    const rows = await withTenantRead(TENANT, async (tx) => {
      const result = await tx
        .select({ id: obligationCollections.id, senderId: obligationCollections.senderId })
        .from(obligationCollections)
        .where(eq(obligationCollections.workspaceSubdomain, TENANT));
      return result;
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "oc-cascade-1", senderId: "cnt-cascade" });
  });
});

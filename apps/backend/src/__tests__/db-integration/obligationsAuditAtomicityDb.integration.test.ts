import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { ObligationCollection } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant, withTenantRead } from "../../db/tenant-context.js";
import { auditTrailEvents } from "../../db/schema/auditTrail.js";
import {
  contacts,
  mujtahidReps,
  mujtahids,
  obligationCollections,
  obligationTypes,
  workspaces,
} from "../../db/schema.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { saveObligationCollection } from "../../db/repositories/obligationCollectionsPersist.js";
import { auditCollectionSaved } from "../../obligations/use-cases/obligationAuditTrail.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = `obl-audit-${randomUUID().slice(0, 8)}`;

/**
 * `audit_trail_events.record_id` is `varchar(128)`; an id past that makes the audit insert fail on
 * the production path — no module mocking — which is exactly the failure mode the transaction must
 * roll back (the same probe `auditAtomicityDb` uses for contacts).
 */
const FAILING_RECEIPT_ID = `oc-${"x".repeat(140)}`;

function receipt(id: string): ObligationCollection {
  return {
    id,
    receipt_no: `REC-${id.slice(-6)}`,
    received_date: "2026-06-15",
    sender_id: "cnt-1",
    amount: 1500.25,
    currency_id: "PKR",
    payment_mode: "Cash",
    obligation_type_id: "ot-audit",
    mujtahid_representative_id: "rep-audit",
    received_by: "u-admin",
  } as ObligationCollection;
}

async function receiptExists(id: string): Promise<boolean> {
  const rows = await withTenantRead(TENANT, (tx) =>
    tx
      .select({ id: obligationCollections.id })
      .from(obligationCollections)
      .where(eq(obligationCollections.id, id)),
  );
  return rows.length > 0;
}

async function auditIdsFor(recordId: string): Promise<string[]> {
  const rows = await withTenantRead(TENANT, (tx) =>
    tx
      .select({ recordId: auditTrailEvents.recordId })
      .from(auditTrailEvents)
      .where(
        and(
          eq(auditTrailEvents.workspaceSubdomain, TENANT),
          eq(auditTrailEvents.recordId, recordId),
        ),
      ),
  );
  return rows.map((row) => row.recordId);
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await withGlobalTenant(async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Obligation Audit" })
      .onConflictDoNothing();
  });
  await withTenant(TENANT, async (tx) => {
    // 0258 added the (workspace_subdomain, sender_id) → contacts FK, so a receipt needs a sender.
    await tx
      .insert(contacts)
      .values({
        id: "cnt-1",
        workspaceSubdomain: TENANT,
        firstName: "Audit",
        name: "Audit Sender",
      })
      .onConflictDoNothing();
    await tx
      .insert(obligationTypes)
      .values({ id: "ot-audit", workspaceSubdomain: TENANT, name: "Khums" })
      .onConflictDoNothing();
    // The receipt's (mujtahid, rep) pair must exist and have a wakala (domain guard) — the FK
    // alone would reject a rep that is not there.
    await tx
      .insert(mujtahids)
      .values({ id: "mj-audit", workspaceSubdomain: TENANT, name: "Audit Mujtahid" })
      .onConflictDoNothing();
    await tx
      .insert(mujtahidReps)
      .values({
        id: "rep-audit",
        workspaceSubdomain: TENANT,
        mujtahidId: "mj-audit",
        name: "Audit Rep",
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
    await tx.delete(obligationTypes).where(eq(obligationTypes.workspaceSubdomain, TENANT));
    await tx.delete(mujtahidReps).where(eq(mujtahidReps.workspaceSubdomain, TENANT));
    await tx.delete(mujtahids).where(eq(mujtahids.workspaceSubdomain, TENANT));
    await tx.delete(contacts).where(eq(contacts.workspaceSubdomain, TENANT));
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  }).catch(() => undefined);
  await closeDatabase();
});

describe("Obligation audit atomicity", () => {
  it("rolls the receipt write back when the audit append fails", async () => {
    await runWithTenant(TENANT, async () => {
      await expect(
        withTenant(TENANT, async () => {
          await saveObligationCollection(TENANT, receipt(FAILING_RECEIPT_ID));
          await auditCollectionSaved(TENANT, null, receipt(FAILING_RECEIPT_ID));
        }),
      ).rejects.toThrow();
    });

    expect(await receiptExists(FAILING_RECEIPT_ID)).toBe(false);
  });

  it("commits exactly one CREATE audit row with the receipt", async () => {
    const id = `oc-${randomUUID().slice(0, 8)}`;
    await runWithTenant(TENANT, async () => {
      await withTenant(TENANT, async () => {
        await saveObligationCollection(TENANT, receipt(id));
        await auditCollectionSaved(TENANT, null, receipt(id));
      });
    });

    expect(await receiptExists(id)).toBe(true);
    expect(await auditIdsFor(id)).toEqual([id]);
  });
});

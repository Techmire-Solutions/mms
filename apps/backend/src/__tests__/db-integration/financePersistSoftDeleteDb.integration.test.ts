import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { invoiceRecordSchema, type Invoice } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { financeInvoices, workspaces } from "../../db/schema.js";
import { bulkSaveInvoices, saveInvoice } from "../../db/repositories/financeInvoicesPersist.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Finance half of the soft-delete parity rule proved for journal entries by
 * `accountingPersistSoftDeleteDb.integration.test.ts`.
 *
 * An invoice save (single or whole-list) re-sends `deletedAt: null` for every
 * active invoice it holds, because the record it is built from was loaded with
 * the soft-delete columns. The upsert must not write them back: trash/restore
 * own them, otherwise a save in one session silently un-deletes an invoice
 * another session archived (or re-trashes a restored one).
 */
const TENANT = "finance-softdelete-parity";
const trashedAt = new Date("2026-02-01T00:00:00.000Z");

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

function invoice(fields: Record<string, unknown>): Invoice {
  return invoiceRecordSchema.parse({ studentId: "s1", dueDate: "2026-03-10", ...fields });
}

async function storedInvoice(id: string) {
  const rows = await withTenant(TENANT, (tx) =>
    tx
      .select({
        finalAmt: financeInvoices.finalAmt,
        deletedAt: financeInvoices.deletedAt,
        deletedBy: financeInvoices.deletedBy,
        deletionReason: financeInvoices.deletionReason,
        restoredAt: financeInvoices.restoredAt,
      })
      .from(financeInvoices)
      .where(and(eq(financeInvoices.workspaceSubdomain, TENANT), eq(financeInvoices.id, id))),
  );
  return rows[0];
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Finance soft delete", enabled: true });
    await tx.insert(financeInvoices).values([
      {
        id: "inv-trashed",
        workspaceSubdomain: TENANT,
        studentId: "s1",
        dueDate: "2026-03-10",
        finalAmt: "500",
        status: "pending",
        deletedAt: trashedAt,
        deletedBy: "other-session",
        deletionReason: "duplicate",
        updatedAt: new Date(),
      },
      {
        id: "inv-active",
        workspaceSubdomain: TENANT,
        studentId: "s1",
        dueDate: "2026-03-11",
        finalAmt: "300",
        status: "pending",
        updatedAt: new Date(),
      },
    ]);
  });
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("invoice upserts never write the soft-delete columns", () => {
  it("does not resurrect a trashed invoice or re-trash an active one on a whole-list save", async () => {
    const batch: Invoice[] = [
      invoice({
        id: "inv-trashed",
        finalAmt: 900,
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
      }),
      invoice({ id: "inv-active", finalAmt: 300, deletedAt: null }),
      invoice({ id: "inv-new", finalAmt: 100, deletedAt: null }),
    ];

    await bulkSaveInvoices(TENANT, batch);

    const trashed = await storedInvoice("inv-trashed");
    // Content still updates…
    expect(Number(trashed?.finalAmt)).toBe(900);
    // …but the trashed state another session owns is untouched.
    expect(trashed?.deletedAt).not.toBeNull();
    expect(trashed?.deletedBy).toBe("other-session");
    expect(trashed?.deletionReason).toBe("duplicate");

    expect((await storedInvoice("inv-active"))?.deletedAt).toBeNull();
    expect((await storedInvoice("inv-new"))?.deletedAt).toBeNull();
  });

  it("does not resurrect a trashed invoice on a single-record save", async () => {
    await saveInvoice(
      TENANT,
      invoice({ id: "inv-trashed", finalAmt: 950, deletedAt: null, deletedBy: null }),
    );

    const trashed = await storedInvoice("inv-trashed");
    expect(Number(trashed?.finalAmt)).toBe(950);
    expect(trashed?.deletedAt).not.toBeNull();
    expect(trashed?.deletedBy).toBe("other-session");
    expect(trashed?.deletionReason).toBe("duplicate");
  });
});

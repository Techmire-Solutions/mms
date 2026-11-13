import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { invoiceRecordSchema, type Invoice } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { financeInvoiceLines, financeInvoices, workspaces } from "../../db/schema.js";
import { saveInvoice } from "../../db/repositories/financeInvoicesPersist.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * The invoice and its lines are one aggregate. They used to be written in two
 * transactions (`saveInvoice` committed the header, then `replaceInvoiceLines`
 * opened its own), so a line failure left an invoice with no lines whenever the
 * caller did not already own a transaction.
 */
const TENANT = "finance-invoice-atomicity";

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

function invoice(fields: Record<string, unknown>): Invoice {
  return invoiceRecordSchema.parse({ dueDate: "2026-05-10", studentId: "s1", ...fields });
}

async function invoiceExists(id: string): Promise<boolean> {
  const rows = await withTenant(TENANT, (tx) =>
    tx
      .select({ id: financeInvoices.id })
      .from(financeInvoices)
      .where(and(eq(financeInvoices.workspaceSubdomain, TENANT), eq(financeInvoices.id, id))),
  );
  return rows.length > 0;
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, (tx) =>
    tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Invoice atomicity", enabled: true }),
  );
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("invoice header and lines commit together (Postgres)", () => {
  it("rolls the invoice back when a line cannot be written", async () => {
    // Two lines with the same primary key: the header write succeeds, the line
    // insert fails. If they were separate transactions the invoice would persist.
    await expect(
      saveInvoice(
        TENANT,
        invoice({
          id: "inv-broken",
          finalAmt: 100,
          baseFee: 100,
          lines: [
            { id: "dup-line", description: "a", quantity: 1, amount: 100, discountAmt: 0 },
            { id: "dup-line", description: "b", quantity: 1, amount: 100, discountAmt: 0 },
          ],
        }),
      ),
    ).rejects.toThrow();

    expect(await invoiceExists("inv-broken")).toBe(false);
  });

  it("writes the invoice and its lines on the happy path", async () => {
    await saveInvoice(
      TENANT,
      invoice({
        id: "inv-fine",
        finalAmt: 100,
        baseFee: 100,
        lines: [{ id: "line-1", description: "a", quantity: 1, amount: 100, discountAmt: 0 }],
      }),
    );
    expect(await invoiceExists("inv-fine")).toBe(true);
    const lines = await withTenant(TENANT, (tx) =>
      tx
        .select({ id: financeInvoiceLines.id })
        .from(financeInvoiceLines)
        .where(eq(financeInvoiceLines.invoiceId, "inv-fine")),
    );
    expect(lines.map((row) => row.id)).toEqual(["line-1"]);
  });
});

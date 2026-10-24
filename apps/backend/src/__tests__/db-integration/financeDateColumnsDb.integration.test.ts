import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { invoiceRecordSchema, type Invoice } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { financeInvoices, workspaces } from "../../db/schema.js";
import { saveInvoice } from "../../db/repositories/financeInvoicesPersist.js";
import { aggregateFinanceCommandMetrics } from "../../db/repositories/financeRepositoryList.js";
import { ValidationError } from "../../lib/httpErrors.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "finance-date-columns-test";

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

async function storedInvoice(id: string) {
  const rows = await withTenant(TENANT, (tx) =>
    tx
      .select({ dueDate: financeInvoices.dueDate, paidDate: financeInvoices.paidDate })
      .from(financeInvoices)
      .where(and(eq(financeInvoices.workspaceSubdomain, TENANT), eq(financeInvoices.id, id))),
  );
  return rows[0];
}

function invoice(fields: Record<string, unknown>): Invoice {
  return invoiceRecordSchema.parse({ studentId: "s1", ...fields });
}

function thisMonthDay(day: number): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${String(day).padStart(2, "0")}`;
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, (tx) =>
    tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Finance dates test", enabled: true }),
  );
});

afterAll(async () => {
  try {
    await purgeTenant();
  } finally {
    await closeDatabase();
  }
});

describe("finance date columns after 0184 (real Postgres)", () => {
  it("given an empty paid date, should store NULL in the date column", async () => {
    // Act
    await saveInvoice(
      TENANT,
      invoice({
        id: "inv-unpaid",
        dueDate: thisMonthDay(20),
        paidDate: "",
        finalAmt: 500,
        status: "pending",
      }),
    );

    // Assert
    expect(await storedInvoice("inv-unpaid")).toEqual({
      dueDate: thisMonthDay(20),
      paidDate: null,
    });
  });

  it("given a date-time paid date, should keep only its calendar day", async () => {
    // Act
    await saveInvoice(
      TENANT,
      invoice({
        id: "inv-paid",
        dueDate: thisMonthDay(10),
        paidDate: `${thisMonthDay(9)}T08:00:00`,
        finalAmt: 300,
        status: "paid",
      }),
    );

    // Assert
    expect(await storedInvoice("inv-paid")).toEqual({
      dueDate: thisMonthDay(10),
      paidDate: thisMonthDay(9),
    });
  });

  it("given an empty or impossible due date, should reject the write with a validation error", async () => {
    // Arrange
    const base = { finalAmt: 1, status: "pending" };

    // Act / Assert
    await expect(
      saveInvoice(TENANT, invoice({ ...base, id: "inv-empty", dueDate: "" })),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      saveInvoice(TENANT, invoice({ ...base, id: "inv-bad", dueDate: "2026-02-31" })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("given date columns, should bucket command metrics by calendar month", async () => {
    // Act
    const metrics = await aggregateFinanceCommandMetrics(TENANT);

    // Assert — paid falls back from paid_date; outstanding is keyed by due_date
    expect(metrics.collectedThisMonth).toBe(300);
    expect(metrics.outstandingThisMonth).toBe(500);
  });
});

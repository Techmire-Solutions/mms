import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { Invoice, Payment } from "@mms/shared";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import { financeInvoices, financePayments, workspaces } from "../../db/schema.js";
import { saveInvoice } from "../../db/repositories/financeInvoicesPersist.js";
import { findInvoiceById } from "../../db/repositories/financeInvoicesRepository.js";
import { findPaymentById, savePayment } from "../../db/repositories/financePaymentsRepository.js";
import { listRealizedFxByCurrency } from "../../db/repositories/accountingFxReportRepository.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "fx-ias21-finance";

async function cleanup(): Promise<void> {
  const { tx, commit, rollback } = await beginLongLivedTenantTransaction(null);
  try {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(financePayments).where(eq(financePayments.workspaceSubdomain, TENANT));
    await tx.delete(financeInvoices).where(eq(financeInvoices.workspaceSubdomain, TENANT));
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
    await commit();
  } catch (error) {
    await rollback().catch(() => undefined);
    throw error;
  }
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await cleanup();
  const { tx, commit } = await beginLongLivedTenantTransaction(null);
  await tx.insert(workspaces).values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: TENANT, enabled: true });
  await commit();
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

const usdInvoice: Invoice = {
  id: "inv-usd",
  studentId: "stu-1",
  studentName: "Student",
  class: "",
  session: "",
  baseFee: 1000,
  discountValue: 0,
  discountAmt: 0,
  finalAmt: 1000,
  status: "pending",
  dueDate: "2026-10-01",
  currency: "USD",
  exchangeRate: "280",
};

describe("IAS 21 finance documents", () => {
  it("given a USD invoice, should keep its currency and booked rate when later saves omit them", async () => {
    // Arrange
    await saveInvoice(TENANT, usdInvoice);

    // Act
    await saveInvoice(TENANT, { ...usdInvoice, currency: undefined, exchangeRate: undefined, paidAmt: 400, status: "partial" });
    const stored = await findInvoiceById(TENANT, "inv-usd");

    // Assert
    expect(stored).toMatchObject({ currency: "USD", exchangeRate: "280", paidAmt: 400, status: "partial" });
  });

  it("given a cross-currency payment, should round-trip settlement rate, applied amount and realized FX", async () => {
    // Arrange
    const payment: Payment = {
      id: "pay-pkr",
      invoiceId: "inv-usd",
      amount: 114000,
      date: "2026-10-15",
      method: "cash",
      note: "",
      currency: "PKR",
      exchangeRate: "285",
      invoiceAmount: 400,
      realizedFx: 2000,
    };

    // Act
    await savePayment(TENANT, payment);
    const stored = await findPaymentById(TENANT, "pay-pkr");

    // Assert
    expect(stored).toMatchObject({
      currency: "PKR",
      exchangeRate: "285",
      invoiceAmount: 400,
      realizedFx: 2000,
    });
  });

  it("given a PKR payment settling a USD invoice, should report its realized FX under USD within the period only", async () => {
    // Arrange / Act
    const october = await listRealizedFxByCurrency(TENANT, "2026-10-01", "2026-10-31");
    const november = await listRealizedFxByCurrency(TENANT, "2026-11-01", "2026-11-30");

    // Assert
    expect(october).toEqual([{ currency: "USD", realized: "2000", payments: 1 }]);
    expect(november).toEqual([]);
  });
});

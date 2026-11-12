import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { buildInvoiceDraftFromEnrollment } from "@mms/shared";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import {
  accountingAccounts,
  accountingCurrencySettings,
  accountingEnabledCurrencies,
  accountingExchangeRates,
  accountingPostingRules,
  enrollments,
  financeInvoices,
  sessionClasses,
  sessions,
  students,
  workspaces,
} from "../../db/schema.js";
import { listBillableEnrollments } from "../../db/repositories/financeInvoiceGenerationRepository.js";
import { findEntryById } from "../../db/repositories/accountingRepository.js";
import { sessionHasEnrollments } from "../../db/repositories/sessionRepository.js";
import { generateInvoices } from "../../finance/use-cases/financeInvoiceGenerationUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { upsertExchangeRates } from "../../db/repositories/accountingExchangeRatesRepository.js";
import { withTenant } from "../../db/tenant-context.js";
import { applyGeneratedInvoiceFx } from "../../finance/use-cases/financeDocumentFx.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = "fx-generated-invoice";

async function cleanup(): Promise<void> {
  const { tx, commit, rollback } = await beginLongLivedTenantTransaction(null, {
    allowGlobal: true,
  });
  try {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(enrollments).where(eq(enrollments.workspaceSubdomain, TENANT));
    await tx.delete(sessionClasses).where(eq(sessionClasses.workspaceSubdomain, TENANT));
    await tx.delete(sessions).where(eq(sessions.workspaceSubdomain, TENANT));
    await tx.delete(students).where(eq(students.workspaceSubdomain, TENANT));
    await tx
      .delete(accountingExchangeRates)
      .where(eq(accountingExchangeRates.workspaceSubdomain, TENANT));
    await tx
      .delete(accountingEnabledCurrencies)
      .where(eq(accountingEnabledCurrencies.workspaceSubdomain, TENANT));
    await tx
      .delete(accountingCurrencySettings)
      .where(eq(accountingCurrencySettings.workspaceSubdomain, TENANT));
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
  const { tx, commit } = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  await tx
    .insert(workspaces)
    .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: TENANT, enabled: true });
  await tx
    .insert(accountingCurrencySettings)
    .values({ workspaceSubdomain: TENANT, functionalCurrency: "PKR", presentationCurrency: "PKR" });
  await tx
    .insert(accountingEnabledCurrencies)
    .values({ workspaceSubdomain: TENANT, currency: "USD" });
  await tx
    .insert(students)
    .values({ id: "stu-1", workspaceSubdomain: TENANT, grNumber: "gr-fx-1", status: "active" });
  await tx.insert(sessions).values([
    { id: "ses-usd", workspaceSubdomain: TENANT, name: "Online (USD)", currency: "USD" },
    { id: "ses-pkr", workspaceSubdomain: TENANT, name: "Campus", currency: "PKR" },
  ]);
  await tx.insert(sessionClasses).values([
    { id: "cls-usd", workspaceSubdomain: TENANT, sessionId: "ses-usd", name: "Hifz online" },
    { id: "cls-pkr", workspaceSubdomain: TENANT, sessionId: "ses-pkr", name: "Hifz" },
  ]);
  await tx.insert(enrollments).values([
    {
      id: "enr-usd",
      workspaceSubdomain: TENANT,
      studentId: "stu-1",
      studentName: "Student",
      sessionId: "ses-usd",
      sessionName: "Online (USD)",
      classId: "cls-usd",
      className: "Hifz online",
      enrolledDate: "2026-11-01",
      baseFee: "50",
      finalFee: "50",
      status: "confirmed",
    },
    {
      id: "enr-pkr",
      workspaceSubdomain: TENANT,
      studentId: "stu-1",
      studentName: "Student",
      sessionId: "ses-pkr",
      sessionName: "Campus",
      classId: "cls-pkr",
      className: "Hifz",
      enrolledDate: "2026-11-01",
      baseFee: "5000",
      finalFee: "5000",
      status: "confirmed",
    },
  ]);
  await commit();
  await upsertExchangeRates(
    TENANT,
    [
      {
        fromCurrency: "USD",
        toCurrency: "PKR",
        rateDate: "2026-11-01",
        rateType: "SPOT",
        rate: "281",
      },
    ],
    null,
  );
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

describe("generated invoices in the session currency", () => {
  it("fails the batch with 422 and persists nothing when the SPOT rate is missing", async () => {
    await withTenant(TENANT, (tx) =>
      tx
        .delete(accountingExchangeRates)
        .where(eq(accountingExchangeRates.workspaceSubdomain, TENANT)),
    );

    await expect(
      runWithTenant(TENANT, () => generateInvoices({ billingPeriod: "2026-11" })),
    ).rejects.toMatchObject({ statusCode: 422 });

    const invoices = await withTenant(TENANT, (tx) =>
      tx.$count(
        financeInvoices,
        and(
          eq(financeInvoices.workspaceSubdomain, TENANT),
          eq(financeInvoices.billingPeriod, "2026-11"),
        ),
      ),
    );
    expect(invoices).toBe(0);

    // Restore the rate: the next run bills exactly once.
    await upsertExchangeRates(
      TENANT,
      [
        {
          fromCurrency: "USD",
          toCurrency: "PKR",
          rateDate: "2026-11-01",
          rateType: "SPOT",
          rate: "281",
        },
      ],
      null,
    );
  });

  it("given a USD session and a PKR session, should bill the USD enrollment in USD at the due-date SPOT rate", async () => {
    // Arrange
    const sources = await listBillableEnrollments(TENANT, {});
    const drafts = sources.map((source) => buildInvoiceDraftFromEnrollment(source, "2026-11", 10));

    // Act
    const stamped = await withTenant(TENANT, () =>
      applyGeneratedInvoiceFx(
        TENANT,
        drafts,
        new Map(sources.map((source) => [source.id, source.sessionCurrency])),
      ),
    );

    // Assert
    expect(
      Object.fromEntries(sources.map((source) => [source.id, source.sessionCurrency])),
    ).toEqual({
      "enr-usd": "USD",
      "enr-pkr": "PKR",
    });
    expect(stamped.find((draft) => draft.enrollmentId === "enr-usd")).toMatchObject({
      currency: "USD",
      exchangeRate: "281",
      finalAmt: 50,
    });
    expect(stamped.find((draft) => draft.enrollmentId === "enr-pkr")).not.toHaveProperty(
      "currency",
    );
  });
});

describe("generated invoices reach the general ledger", () => {
  it("posts a balanced functional entry per generated invoice at the booked rate", async () => {
    await withTenant(TENANT, async (tx) => {
      await tx.insert(accountingAccounts).values([
        {
          id: "ar",
          workspaceSubdomain: TENANT,
          code: "1100",
          name: "Fees receivable",
          type: "Asset",
        },
        { id: "cash", workspaceSubdomain: TENANT, code: "1000", name: "Cash", type: "Asset" },
        {
          id: "income",
          workspaceSubdomain: TENANT,
          code: "4000",
          name: "Fee income",
          type: "Revenue",
        },
      ]);
      await tx.insert(accountingPostingRules).values({
        workspaceSubdomain: TENANT,
        arAccountId: "ar",
        cashAccountId: "cash",
        incomeAccountId: "income",
      });
    });

    const result = await runWithTenant(TENANT, () =>
      generateInvoices({ billingPeriod: "2026-11" }),
    );

    expect(result).toMatchObject({ created: 2, skipped: 0, eligible: 2, posted: 2, unposted: 0 });

    const invoices = await withTenant(TENANT, (tx) =>
      tx
        .select({
          id: financeInvoices.id,
          currency: financeInvoices.currency,
          exchangeRate: financeInvoices.exchangeRate,
          finalAmt: financeInvoices.finalAmt,
          dueDate: financeInvoices.dueDate,
        })
        .from(financeInvoices)
        .where(eq(financeInvoices.workspaceSubdomain, TENANT)),
    );
    expect(invoices).toHaveLength(2);

    const usd = invoices.find((invoice) => invoice.currency === "USD");
    // Default dueDays is 30, clamped to the month end; the SPOT rate seeded on
    // 2026-11-01 is the latest on or before it.
    expect(usd).toMatchObject({ finalAmt: "50.00", dueDate: "2026-11-30" });
    expect(Number(usd?.exchangeRate)).toBe(281);

    const entry = await findEntryById(TENANT, `je-invoice-${usd?.id}`);
    expect(entry?.date).toBe("2026-11-30");
    expect(entry?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          account_id: "ar",
          debit: 14050,
          txn_currency: "USD",
          txn_debit: "50.00",
          exchange_rate: "281",
        }),
        expect.objectContaining({ account_id: "income", credit: 14050 }),
      ]),
    );
  });

  it("does not bill the same period twice", async () => {
    const again = await runWithTenant(TENANT, () => generateInvoices({ billingPeriod: "2026-11" }));
    expect(again).toMatchObject({ created: 0, skipped: 2, posted: 0, unposted: 0 });
  });

  it("backs duplicate billing with a unique active invoice per enrollment and period", async () => {
    await expect(
      withTenant(TENANT, (tx) =>
        tx.insert(financeInvoices).values({
          id: "inv-duplicate",
          workspaceSubdomain: TENANT,
          studentId: "stu-1",
          dueDate: "2026-11-10",
          finalAmt: "50",
          status: "pending",
          enrollmentId: "enr-usd",
          billingPeriod: "2026-11",
        }),
      ),
    ).rejects.toThrow();
  });

  it("knows a session with enrollments (the currency-edit guard)", async () => {
    expect(await sessionHasEnrollments(TENANT, "ses-usd")).toBe(true);
    expect(await sessionHasEnrollments(TENANT, "ses-unknown")).toBe(false);
  });
});

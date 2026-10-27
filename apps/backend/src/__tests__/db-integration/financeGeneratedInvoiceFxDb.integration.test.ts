import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { buildInvoiceDraftFromEnrollment } from "@mms/shared";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import {
  accountingCurrencySettings,
  accountingEnabledCurrencies,
  accountingExchangeRates,
  enrollments,
  sessionClasses,
  sessions,
  students,
  workspaces,
} from "../../db/schema.js";
import { listBillableEnrollments } from "../../db/repositories/financeInvoiceGenerationRepository.js";
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

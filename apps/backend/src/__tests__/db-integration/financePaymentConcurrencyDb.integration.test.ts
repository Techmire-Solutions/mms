import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import {
  accountingAccounts,
  accountingEntries,
  accountingPostingRules,
  auditTrailEvents,
  financeInvoices,
  financePayments,
  students,
  workspaces,
} from "../../db/schema.js";
import { financeUseCases } from "../../finance/use-cases/financeUseCases.js";
import type { PaymentCreateInput } from "@mms/shared";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const SUFFIX = randomUUID().slice(0, 8);
const TENANT = `fin-payment-race-${SUFFIX}`;
const STUDENT_ID = `stu-${SUFFIX}`;
const AR = `ar-${SUFFIX}`;
const CASH = `cash-${SUFFIX}`;
const INCOME = `inc-${SUFFIX}`;

async function cleanup(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    for (const table of [
      "audit_trail_events",
      "accounting_journal_lines",
      "accounting_entries",
      "accounting_posting_rules",
      "accounting_accounts",
      "finance_payments",
      "finance_invoices",
      "students",
    ]) {
      await tx.execute(sql.raw(`DELETE FROM "${table}" WHERE workspace_subdomain = '${TENANT}'`));
    }
    await tx.execute(sql`DELETE FROM workspaces WHERE subdomain = ${TENANT}`);
  });
}

async function seedInvoice(id: string, dueDate = "2026-09-01"): Promise<void> {
  await withTenant(TENANT, (tx) =>
    tx.insert(financeInvoices).values({
      id,
      workspaceSubdomain: TENANT,
      studentId: STUDENT_ID,
      dueDate,
      finalAmt: "1000",
      status: "pending",
      paidAmt: "0",
      familyContactId: null,
    }),
  );
}

function paymentInput(
  id: string,
  invoiceId: string,
  amount: number,
  date = "2026-09-15",
): PaymentCreateInput {
  return {
    id,
    invoiceId,
    studentId: STUDENT_ID,
    studentName: "Paying Student",
    amount,
    date,
    method: "Cash",
    receivedBy: "tester",
  } as PaymentCreateInput;
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await cleanup();
  await withGlobalTenant(async (tx) => {
    await tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: TENANT,
      enabled: true,
    });
  });
  await withTenant(TENANT, async (tx) => {
    await tx.insert(students).values({
      id: STUDENT_ID,
      workspaceSubdomain: TENANT,
      status: "active",
    });
    await tx.insert(accountingAccounts).values([
      { id: AR, workspaceSubdomain: TENANT, code: "1100", name: "Receivable", type: "Asset" },
      { id: CASH, workspaceSubdomain: TENANT, code: "1000", name: "Cash", type: "Asset" },
      { id: INCOME, workspaceSubdomain: TENANT, code: "4100", name: "Fees", type: "Revenue" },
    ]);
    await tx.insert(accountingPostingRules).values({
      workspaceSubdomain: TENANT,
      arAccountId: AR,
      cashAccountId: CASH,
      incomeAccountId: INCOME,
    });
  });
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

async function snapshot(invoiceId: string) {
  const [invoice] = await withTenant(TENANT, (tx) =>
    tx
      .select({ paidAmt: financeInvoices.paidAmt, status: financeInvoices.status })
      .from(financeInvoices)
      .where(eq(financeInvoices.id, invoiceId)),
  );
  const payments = await withTenant(TENANT, (tx) =>
    tx
      .select({ id: financePayments.id })
      .from(financePayments)
      .where(
        and(
          eq(financePayments.workspaceSubdomain, TENANT),
          eq(financePayments.invoiceId, invoiceId),
        ),
      ),
  );
  const paymentIds = payments.map((payment) => payment.id);
  const paymentJournals = paymentIds.length
    ? await withTenant(TENANT, (tx) =>
        tx
          .select({ id: accountingEntries.id })
          .from(accountingEntries)
          .where(
            and(
              eq(accountingEntries.workspaceSubdomain, TENANT),
              eq(accountingEntries.sourceType, "payment"),
              inArray(accountingEntries.sourceId, paymentIds),
            ),
          ),
      )
    : [];
  const paymentAudits = paymentIds.length
    ? await withTenant(TENANT, (tx) =>
        tx
          .select({ id: auditTrailEvents.id })
          .from(auditTrailEvents)
          .where(
            and(
              eq(auditTrailEvents.workspaceSubdomain, TENANT),
              eq(auditTrailEvents.tableName, "finance_payments"),
              inArray(auditTrailEvents.recordId, paymentIds),
            ),
          ),
      )
    : [];
  return {
    paidAmt: Number(invoice?.paidAmt ?? 0),
    status: invoice?.status,
    paymentCount: payments.length,
    journalCount: paymentJournals.length,
    auditCount: paymentAudits.length,
  };
}

describe("concurrent invoice payments (Postgres)", () => {
  it("commits both payments when they fit and keeps the ledger balanced", async () => {
    const invoiceId = `inv-both-${SUFFIX}`;
    await seedInvoice(invoiceId);

    await Promise.all([
      runWithTenant(TENANT, () =>
        financeUseCases.createPayment(paymentInput(`p1-${SUFFIX}`, invoiceId, 300)),
      ),
      runWithTenant(TENANT, () =>
        financeUseCases.createPayment(paymentInput(`p2-${SUFFIX}`, invoiceId, 400)),
      ),
    ]);

    const state = await snapshot(invoiceId);
    expect(state.paidAmt).toBe(700);
    expect(state.status).toBe("partial");
    expect(state.paymentCount).toBe(2);
    expect(state.journalCount).toBe(2);
    expect(state.auditCount).toBe(2);

    // Every payment journal balances at the database's own accounting guard.
    const imbalance = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT COALESCE(SUM(l.debit - l.credit), 0)::numeric AS net
          FROM accounting_journal_lines l
          JOIN accounting_entries e
            ON e.workspace_subdomain = l.workspace_subdomain AND e.id = l.entry_id
         WHERE l.workspace_subdomain = ${TENANT} AND e.source_type = 'payment'
      `),
    );
    expect(Number((imbalance.rows[0] as { net: string }).net)).toBe(0);
  });

  it("never overpays when concurrent payments exceed the balance", async () => {
    const invoiceId = `inv-over-${SUFFIX}`;
    await seedInvoice(invoiceId);

    const results = await Promise.allSettled([
      runWithTenant(TENANT, () =>
        financeUseCases.createPayment(paymentInput(`o1-${SUFFIX}`, invoiceId, 400)),
      ),
      runWithTenant(TENANT, () =>
        financeUseCases.createPayment(paymentInput(`o2-${SUFFIX}`, invoiceId, 400)),
      ),
      runWithTenant(TENANT, () =>
        financeUseCases.createPayment(paymentInput(`o3-${SUFFIX}`, invoiceId, 400)),
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled").length;
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toBe(2);
    expect(rejected).toHaveLength(1);
    for (const failure of rejected) {
      expect(String((failure as PromiseRejectedResult).reason)).toMatch(/exceeds the remaining/);
    }

    const state = await snapshot(invoiceId);
    expect(state.paidAmt).toBe(800);
    expect(state.paymentCount).toBe(2);
    expect(state.journalCount).toBe(2);
    // The rejected attempt must not leave a payment row, journal or audit trail.
    expect(state.auditCount).toBe(2);
  });
});

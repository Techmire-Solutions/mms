import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, desc, eq, sql } from "drizzle-orm";
import type { JournalEntry } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import {
  accountingAccounts,
  accountingEntries,
  accountingJournalLines,
  auditTrailEvents,
  financeInvoices,
  financePayments,
  students,
  workspaces,
} from "../../db/schema.js";
import { findInvoiceById } from "../../db/repositories/financeInvoicesRepository.js";
import { findAccountById } from "../../db/repositories/accountingAccountsRepository.js";
import { findEntryById } from "../../db/repositories/accountingRepository.js";
import { allocateVoucherNumbers } from "../../db/repositories/accountingVoucherRepository.js";
import { accountingRepository } from "../../accounting/repository/accountingRepositoryAdapter.js";
import { upsertEntriesHelper } from "../../accounting/use-cases/accountingEntryMutationUseCases.js";
import { accountingUseCases } from "../../accounting/use-cases/accountingUseCases.js";
import { financeUseCases } from "../../finance/use-cases/financeUseCases.js";
import { upsertVoucherNumbering } from "../../accounting/use-cases/accountingVoucherNumberingUseCases.js";
import { createCreditNote } from "../../finance/use-cases/financeCollectUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const SUFFIX = randomUUID().slice(0, 8);
const TENANT_A = `fin-sec-a-${SUFFIX}`;
const TENANT_B = `fin-sec-b-${SUFFIX}`;
const TENANTS = [TENANT_A, TENANT_B];

const INVOICE_A = `inv-a-${SUFFIX}`;
const INVOICE_B = `inv-b-${SUFFIX}`;
const ENTRY_A = `je-a-${SUFFIX}`;
const ENTRY_B = `je-b-${SUFFIX}`;
const ACCOUNT_A = `acc-a-${SUFFIX}`;
const ACCOUNT_B = `acc-b-${SUFFIX}`;

function journalEntry(id: string, accountId: string, ref: string): JournalEntry {
  return {
    id,
    date: "2026-11-01",
    ref,
    description: "Isolation probe",
    status: "draft",
    created_by: "test",
    tags: [],
    attachments: [],
    fiscal_year: "",
    lines: [
      { id: `${id}-l1`, account_id: accountId, debit: 100, credit: 0, description: "" },
      { id: `${id}-l2`, account_id: accountId, debit: 0, credit: 100, description: "" },
    ],
  } as JournalEntry;
}

async function seedTenant(tenant: string, invoiceId: string, entryId: string, accountId: string) {
  await withTenant(tenant, async (tx) => {
    await tx.insert(accountingAccounts).values({
      id: accountId,
      workspaceSubdomain: tenant,
      code: "1100",
      name: "Receivable",
      type: "Asset",
      isMonetary: true,
    });
    await tx.insert(students).values({
      id: `stu-${tenant}`,
      workspaceSubdomain: tenant,
      status: "active",
    });
    await tx.insert(financeInvoices).values({
      id: invoiceId,
      workspaceSubdomain: tenant,
      studentId: `stu-${tenant}`,
      dueDate: "2026-11-30",
      finalAmt: "500",
      status: "pending",
      paidAmt: "0",
    });
    await tx.insert(accountingEntries).values({
      id: entryId,
      workspaceSubdomain: tenant,
      date: "2026-11-01",
      ref: `REF-${entryId}`,
      description: "Isolation probe",
      status: "draft",
      createdBy: "test",
      fiscalYear: "",
    });
    await tx.insert(accountingJournalLines).values([
      {
        id: `${entryId}-l1`,
        workspaceSubdomain: tenant,
        entryId,
        accountId,
        debit: "100.00",
        credit: "0",
        description: "",
      },
      {
        id: `${entryId}-l2`,
        workspaceSubdomain: tenant,
        entryId,
        accountId,
        debit: "0",
        credit: "100.00",
        description: "",
      },
    ]);
  });
}

async function cleanup(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    for (const tenant of TENANTS) {
      await tx.execute(sql`DELETE FROM audit_trail_events WHERE workspace_subdomain = ${tenant}`);
    }
    for (const tenant of TENANTS) {
      await tx.execute(sql`DELETE FROM workspaces WHERE subdomain = ${tenant}`);
    }
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await cleanup();
  await withGlobalTenant(async (tx) => {
    await tx.insert(workspaces).values(
      TENANTS.map((subdomain) => ({
        id: subdomain,
        subdomain,
        madrasaName: subdomain,
        enabled: true,
      })),
    );
  });
  await seedTenant(TENANT_A, INVOICE_A, ENTRY_A, ACCOUNT_A);
  await seedTenant(TENANT_B, INVOICE_B, ENTRY_B, ACCOUNT_B);
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

describe("finance/accounting tenant isolation (real Postgres)", () => {
  it("refuses by-id reads of another tenant's invoice, entry and account", async () => {
    await expect(
      withTenant(TENANT_B, () => findInvoiceById(TENANT_B, INVOICE_A)),
    ).resolves.toBeNull();
    await expect(withTenant(TENANT_B, () => findEntryById(TENANT_B, ENTRY_A))).resolves.toBeNull();
    await expect(
      withTenant(TENANT_B, () => findAccountById(TENANT_B, ACCOUNT_A)),
    ).resolves.toBeNull();
    // The rows really exist for their owner — proving the read above is scoped, not empty data.
    await expect(
      withTenant(TENANT_A, () => findInvoiceById(TENANT_A, INVOICE_A)),
    ).resolves.not.toBeNull();
  });

  it("scopes lists and report aggregates to the request tenant", async () => {
    const entriesB = await runWithTenant(TENANT_B, () => accountingUseCases.loadEntries());
    expect(entriesB.map((entry) => entry.id)).toEqual([ENTRY_B]);

    const report = await runWithTenant(TENANT_B, () =>
      accountingUseCases.loadAccountingReportAggregates({}),
    );
    const accountIds = report.trialBalance.map((row) => row.id);
    expect(accountIds).not.toContain(ACCOUNT_A);
  });

  it("keeps voucher counters per tenant", async () => {
    const config = {
      autoGenerate: true,
      prefix: "SEC",
      delimiter: "-" as const,
      yearFormat: "NONE" as const,
      sequenceDigits: 4,
      startingSequence: 1,
      rolloverPolicy: "never" as const,
    };
    await runWithTenant(TENANT_A, () => upsertVoucherNumbering(config));
    await runWithTenant(TENANT_B, () => upsertVoucherNumbering(config));

    const a = await withTenant(TENANT_A, () =>
      allocateVoucherNumbers(TENANT_A, { date: "2026-11-01", count: 2 }),
    );
    const b = await withTenant(TENANT_B, () =>
      allocateVoucherNumbers(TENANT_B, { date: "2026-11-01", count: 1 }),
    );

    expect(a).toEqual(["SEC-0001", "SEC-0002"]);
    // B must not inherit A's consumption.
    expect(b).toEqual(["SEC-0001"]);
  });
});

describe("audit atomicity and coverage for finance mutations", () => {
  it("rolls a journal write back when its audit row cannot be appended", async () => {
    // Business id columns are `text`; audit record_id is varchar(128), so a longer
    // id fails naturally at the audit append (no mocks) and must roll the entry back.
    const longId = `je-${"x".repeat(140)}`;
    await runWithTenant(TENANT_A, async () => {
      await expect(
        upsertEntriesHelper(accountingRepository, async () => [], [
          journalEntry(longId, ACCOUNT_A, "LONG-1"),
        ]),
      ).rejects.toThrow();
    });

    const stored = await withTenant(TENANT_A, (tx) =>
      tx
        .select({ id: accountingEntries.id })
        .from(accountingEntries)
        .where(eq(accountingEntries.id, longId)),
    );
    expect(stored).toEqual([]);
    const audits = await withTenant(TENANT_A, (tx) =>
      tx
        .select({ id: auditTrailEvents.id })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT_A),
            eq(auditTrailEvents.recordId, longId),
          ),
        ),
    );
    expect(audits).toEqual([]);
  });

  it("rolls a payment, its invoice balance and its ledger entry back when the audit append fails", async () => {
    const longPaymentId = `pay-${"x".repeat(140)}`;
    await expect(
      runWithTenant(TENANT_A, () =>
        financeUseCases.createPayment({
          id: longPaymentId,
          invoiceId: INVOICE_A,
          studentId: `stu-${TENANT_A}`,
          amount: 100,
          date: "2026-11-05",
          method: "Cash",
          receivedBy: "tester",
        } as never),
      ),
    ).rejects.toThrow();

    const payments = await withTenant(TENANT_A, (tx) =>
      tx
        .select({ id: financePayments.id })
        .from(financePayments)
        .where(eq(financePayments.id, longPaymentId)),
    );
    expect(payments).toEqual([]);
    const invoice = await withTenant(TENANT_A, (tx) =>
      tx
        .select({ paidAmt: financeInvoices.paidAmt })
        .from(financeInvoices)
        .where(eq(financeInvoices.id, INVOICE_A)),
    );
    expect(Number(invoice[0]?.paidAmt ?? 0)).toBe(0);
    const paymentJournals = await withTenant(TENANT_A, (tx) =>
      tx
        .select({ id: accountingEntries.id })
        .from(accountingEntries)
        .where(eq(accountingEntries.sourceType, "payment")),
    );
    expect(paymentJournals).toEqual([]);
    const audits = await withTenant(TENANT_A, (tx) =>
      tx
        .select({ id: auditTrailEvents.id })
        .from(auditTrailEvents)
        .where(eq(auditTrailEvents.recordId, longPaymentId)),
    );
    expect(audits).toEqual([]);
  });

  it("audits a credit note with its waiver justification", async () => {
    await runWithTenant(TENANT_A, () =>
      createCreditNote({ invoiceId: INVOICE_A, amount: 50, reason: "hardship waiver" }),
    );

    const rows = await withTenant(TENANT_A, (tx) =>
      tx
        .select({ actionType: auditTrailEvents.actionType, newState: auditTrailEvents.newState })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT_A),
            eq(auditTrailEvents.tableName, "finance_credit_notes"),
          ),
        ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.actionType).toBe("CREATE");
    expect(JSON.parse(String(rows[0]?.newState))).toMatchObject({
      amount: 50,
      reason: "hardship waiver",
    });
  });

  it("audits invoice archive and restore in the same transaction", async () => {
    await runWithTenant(TENANT_A, () =>
      financeUseCases.deleteInvoiceById(INVOICE_A, "u-admin", "duplicate billing"),
    );
    const invoiceAuditRows = () =>
      withTenant(TENANT_A, (tx) =>
        tx
          .select({ actionType: auditTrailEvents.actionType, newState: auditTrailEvents.newState })
          .from(auditTrailEvents)
          .where(
            and(
              eq(auditTrailEvents.workspaceSubdomain, TENANT_A),
              eq(auditTrailEvents.tableName, "finance_invoices"),
            ),
          ),
      );
    const rows = await invoiceAuditRows();
    expect(rows.some((row) => row.actionType === "DELETE")).toBe(true);
    expect(rows.map((row) => String(row.newState)).join(" ")).toContain("invoice_archived");

    await runWithTenant(TENANT_A, () => financeUseCases.restoreInvoiceById(INVOICE_A, "u-admin"));
    const afterRestore = await invoiceAuditRows();
    expect(afterRestore.some((row) => row.actionType === "RESTORE")).toBe(true);
  });

  it("audits voucher-numbering configuration changes with before and after state", async () => {
    await runWithTenant(TENANT_B, () =>
      upsertVoucherNumbering({
        autoGenerate: true,
        prefix: "NUM",
        delimiter: "/",
        yearFormat: "YYYY",
        sequenceDigits: 3,
        startingSequence: 1,
        rolloverPolicy: "annual_calendar",
      }),
    );
    // The counters test also updated B's numbering, so take the newest event.
    const [row] = await withTenant(TENANT_B, (tx) =>
      tx
        .select({ oldState: auditTrailEvents.oldState, newState: auditTrailEvents.newState })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT_B),
            eq(auditTrailEvents.tableName, "accounting_voucher_numbering"),
          ),
        )
        .orderBy(desc(auditTrailEvents.id))
        .limit(1),
    );
    expect(JSON.parse(String(row?.oldState))).toMatchObject({ prefix: "SEC" });
    expect(JSON.parse(String(row?.newState))).toMatchObject({
      prefix: "NUM",
      yearFormat: "YYYY",
    });
  });
});

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
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
  students,
  workspaces,
} from "../../db/schema.js";
import {
  collectOverdueInvoices,
  remindOpenInvoices,
} from "../../finance/use-cases/financeCollectUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const SUFFIX = randomUUID().slice(0, 8);
const TENANT = `fin-collect-${SUFFIX}`;
const INVOICE_ID = `inv-collect-${SUFFIX}`;
const STUDENT_ID = `stu-collect-${SUFFIX}`;

async function cleanup(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    for (const table of [
      "audit_trail_events",
      "accounting_journal_lines",
      "accounting_entries",
      "accounting_posting_rules",
      "accounting_accounts",
      "finance_invoices",
      "students",
    ]) {
      await tx.execute(sql.raw(`DELETE FROM "${table}" WHERE workspace_subdomain = '${TENANT}'`));
    }
    await tx.execute(sql`DELETE FROM workspaces WHERE subdomain = ${TENANT}`);
  });
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
    await tx
      .insert(students)
      .values({ id: STUDENT_ID, workspaceSubdomain: TENANT, status: "active" });
    await tx.insert(accountingAccounts).values([
      {
        id: `ar-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        code: "1100",
        name: "Receivable",
        type: "Asset",
      },
      {
        id: `inc-${SUFFIX}`,
        workspaceSubdomain: TENANT,
        code: "4100",
        name: "Fee income",
        type: "Revenue",
      },
    ]);
    await tx.insert(accountingPostingRules).values({
      workspaceSubdomain: TENANT,
      arAccountId: `ar-${SUFFIX}`,
      incomeAccountId: `inc-${SUFFIX}`,
    });
    await tx.insert(financeInvoices).values({
      id: INVOICE_ID,
      workspaceSubdomain: TENANT,
      studentId: STUDENT_ID,
      dueDate: "2026-10-01",
      finalAmt: "1000",
      status: "pending",
      paidAmt: "0",
      familyContactId: null,
    });
  });
});

afterAll(async () => {
  await cleanup();
  await closeDatabase();
});

describe("overdue collection is concurrency-safe", () => {
  it("applies one late fee and posts one journal when two collectors race", async () => {
    const [first, second] = await Promise.all([
      runWithTenant(TENANT, () => collectOverdueInvoices({ applyLateFee: true })),
      runWithTenant(TENANT, () => collectOverdueInvoices({ applyLateFee: true })),
    ]);

    const [invoice] = await withTenant(TENANT, (tx) =>
      tx
        .select({ lateFeeAmt: financeInvoices.lateFeeAmt })
        .from(financeInvoices)
        .where(eq(financeInvoices.id, INVOICE_ID)),
    );
    expect(Number(invoice?.lateFeeAmt ?? 0)).toBe(50);

    const journals = await withTenant(TENANT, (tx) =>
      tx
        .select({ id: accountingEntries.id })
        .from(accountingEntries)
        .where(
          and(
            eq(accountingEntries.workspaceSubdomain, TENANT),
            eq(accountingEntries.sourceType, "invoice"),
            eq(accountingEntries.sourceId, `latefee:${INVOICE_ID}`),
          ),
        ),
    );
    expect(journals).toHaveLength(1);

    const feeAudits = await withTenant(TENANT, (tx) =>
      tx
        .select({ id: auditTrailEvents.id, newState: auditTrailEvents.newState })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.tableName, "finance_invoices"),
            eq(auditTrailEvents.recordId, INVOICE_ID),
          ),
        ),
    );
    expect(feeAudits).toHaveLength(1);
    expect(String(feeAudits[0]?.newState)).toContain("late_fee_applied");

    // Exactly one run reports the fee; the other matched zero rows.
    expect(first.lateFeesApplied + second.lateFeesApplied).toBe(1);
  });

  it("does not re-apply a fee on a later run", async () => {
    const again = await runWithTenant(TENANT, () => collectOverdueInvoices({ applyLateFee: true }));
    expect(again.lateFeesApplied).toBe(0);
  });
});

describe("reminders are claimed before notifying", () => {
  it("lets only one concurrent run claim an invoice", async () => {
    const [first, second] = await Promise.all([
      runWithTenant(TENANT, () => remindOpenInvoices({})),
      runWithTenant(TENANT, () => remindOpenInvoices({})),
    ]);

    const [invoice] = await withTenant(TENANT, (tx) =>
      tx
        .select({
          reminderCount: financeInvoices.reminderCount,
          lastRemindedAt: financeInvoices.lastRemindedAt,
        })
        .from(financeInvoices)
        .where(eq(financeInvoices.id, INVOICE_ID)),
    );
    expect(invoice?.reminderCount).toBe(1);
    expect(invoice?.lastRemindedAt).not.toBeNull();

    // The invoice has no family contact, so neither run can build a recipient — but
    // the claim is single-winner, which is what prevents duplicate notifications.
    expect(first.recipients).toHaveLength(0);
    expect(second.recipients).toHaveLength(0);

    const reminderAudits = await withTenant(TENANT, (tx) =>
      tx
        .select({ id: auditTrailEvents.id })
        .from(auditTrailEvents)
        .where(
          and(
            eq(auditTrailEvents.workspaceSubdomain, TENANT),
            eq(auditTrailEvents.tableName, "finance_invoices"),
            eq(auditTrailEvents.recordId, TENANT),
          ),
        ),
    );
    // No summary row without a recipient; nothing claims twice.
    expect(reminderAudits.length).toBeLessThanOrEqual(1);
  });
});

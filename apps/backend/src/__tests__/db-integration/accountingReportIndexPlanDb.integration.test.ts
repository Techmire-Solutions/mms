import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import {
  accountingAccounts,
  accountingEntries,
  accountingJournalLines,
  financeInvoices,
  workspaces,
} from "../../db/schema.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const SUFFIX = randomUUID().slice(0, 8);
const TENANT = `report-plan-${SUFFIX}`;
const CASH = `plan-cash-${SUFFIX}`;
const REVENUE = `plan-rev-${SUFFIX}`;
const ENTRY_COUNT = 10_000;

async function purge(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    for (const table of [
      "accounting_journal_lines",
      "accounting_entries",
      "accounting_accounts",
      "finance_invoices",
    ]) {
      await tx.execute(sql.raw(`DELETE FROM "${table}" WHERE workspace_subdomain = '${TENANT}'`));
    }
    await tx.execute(sql`DELETE FROM workspaces WHERE subdomain = ${TENANT}`);
  });
}

interface PlanNode {
  "Node Type": string;
  "Relation Name"?: string;
  "Index Name"?: string;
  Plans?: PlanNode[];
}

function flatten(node: PlanNode, acc: PlanNode[] = []): PlanNode[] {
  acc.push(node);
  for (const child of node.Plans ?? []) flatten(child, acc);
  return acc;
}

async function explain(
  tenant: string,
  query: ReturnType<typeof sql>,
  options: { disableSeqScan?: boolean } = {},
): Promise<PlanNode[]> {
  return withTenant(tenant, async (tx) => {
    // A small dev dataset legitimately prefers a sequential scan; disabling it
    // proves the index is applicable instead of asserting a plan shape.
    if (options.disableSeqScan) await tx.execute(sql`SET LOCAL enable_seqscan = off`);
    const result = await tx.execute(sql`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`);
    const [row] = result.rows as Array<{ "QUERY PLAN": Array<{ Plan: PlanNode }> }>;
    return row ? flatten(row["QUERY PLAN"][0]!.Plan) : [];
  });
}

function assertNoSeqScanOn(plan: PlanNode[], tables: string[]): void {
  const seq = plan.filter(
    (node) => node["Node Type"] === "Seq Scan" && tables.includes(node["Relation Name"] ?? ""),
  );
  expect(seq.map((node) => node["Relation Name"])).toEqual([]);
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  await withGlobalTenant(async (tx) => {
    await tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: "Report plan",
      enabled: true,
    });
  });
  await withTenant(TENANT, async (tx) => {
    await tx.insert(accountingAccounts).values([
      { id: CASH, workspaceSubdomain: TENANT, code: "1000", name: "Cash", type: "Asset" },
      { id: REVENUE, workspaceSubdomain: TENANT, code: "4000", name: "Fees", type: "Revenue" },
    ]);
  });
  // Seed a realistic ledger size in batches; each entry balances.
  for (let batch = 0; batch < ENTRY_COUNT / 1_000; batch += 1) {
    await withTenant(TENANT, async (tx) => {
      const entries = Array.from({ length: 1_000 }, (_, index) => {
        const seq = batch * 1_000 + index;
        return {
          id: `plan-e-${SUFFIX}-${seq}`,
          workspaceSubdomain: TENANT,
          date: `2026-${String((seq % 12) + 1).padStart(2, "0")}-15`,
          ref: `plan-ref-${SUFFIX}-${seq}`,
          description: "plan seed",
          status: "posted",
        };
      });
      await tx.insert(accountingEntries).values(entries);
      await tx.insert(accountingJournalLines).values(
        entries.flatMap((entry) => [
          {
            id: `${entry.id}-d`,
            workspaceSubdomain: TENANT,
            entryId: entry.id,
            accountId: CASH,
            debit: "100",
            credit: "0",
          },
          {
            id: `${entry.id}-c`,
            workspaceSubdomain: TENANT,
            entryId: entry.id,
            accountId: REVENUE,
            debit: "0",
            credit: "100",
          },
        ]),
      );
    });
  }
  await withTenant(TENANT, async (tx) => {
    const invoices = Array.from({ length: 2_000 }, (_, index) => ({
      id: `plan-inv-${SUFFIX}-${index}`,
      workspaceSubdomain: TENANT,
      studentId: `plan-stu-${SUFFIX}-${index % 50}`,
      studentName: `Student ${index % 50}`,
      class: "Hifz",
      session: "2026",
      dueDate: `2026-${String((index % 12) + 1).padStart(2, "0")}-10`,
      finalAmt: "250",
      status: "pending",
    }));
    await tx.insert(financeInvoices).values(invoices);
  });
  // Fresh statistics are what make the planner use the indexes.
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`ANALYZE accounting_entries`);
    await tx.execute(sql`ANALYZE accounting_journal_lines`);
    await tx.execute(sql`ANALYZE finance_invoices`);
  });
});

afterAll(async () => {
  await purge();
  await closeDatabase();
});

describe("report aggregations are index-backed at scale", () => {
  it("trial balance access path uses the entry/line indexes, not sequential scans", async () => {
    const plan = await explain(
      TENANT,
      sql`SELECT a.id, a.code, COALESCE(SUM(pl.debit), 0)
            FROM accounting_accounts a
            LEFT JOIN (
              SELECT l.workspace_subdomain, l.account_id, l.debit, l.credit
                FROM accounting_journal_lines l
                JOIN accounting_entries e
                  ON e.workspace_subdomain = l.workspace_subdomain AND e.id = l.entry_id
               WHERE e.workspace_subdomain = ${TENANT}
                 AND e.deleted_at IS NULL
                 AND e.status = 'posted'
                 AND e.date >= '2026-01-01'
                 AND e.date <= '2026-12-31'
                 AND e.source_type IS DISTINCT FROM 'closing'
            ) pl
              ON pl.workspace_subdomain = a.workspace_subdomain AND pl.account_id = a.id
           WHERE a.workspace_subdomain = ${TENANT} AND a.deleted_at IS NULL
           GROUP BY a.id, a.code`,
    );
    assertNoSeqScanOn(plan, ["accounting_journal_lines", "accounting_entries"]);
    expect(
      plan.some(
        (node) =>
          node["Relation Name"] === "accounting_entries" &&
          (node["Node Type"] === "Index Scan" ||
            node["Node Type"] === "Index Only Scan" ||
            node["Node Type"] === "Bitmap Index Scan"),
      ),
    ).toBe(true);
  });

  it("has an index the aging predicate can use", async () => {
    // Aging aggregates every open invoice, so a sequential scan is the honest plan
    // at this size; disabling it proves the status/due-date index is applicable.
    const plan = await explain(
      TENANT,
      sql`SELECT i.student_id,
                 SUM(CASE WHEN i.due_date >= DATE '2026-06-30' THEN i.final_amt ELSE 0 END)
            FROM finance_invoices i
           WHERE i.workspace_subdomain = ${TENANT}
             AND i.deleted_at IS NULL
             AND i.status IN ('pending', 'partial', 'overdue')
             AND i.final_amt > 0
           GROUP BY i.student_id`,
      { disableSeqScan: true },
    );
    expect(
      plan.some(
        (node) =>
          node["Relation Name"] === "finance_invoices" &&
          ["Index Scan", "Index Only Scan", "Bitmap Index Scan", "Bitmap Heap Scan"].includes(
            node["Node Type"],
          ),
      ),
    ).toBe(true);
  });

  it("keeps the report-supporting indexes in place", async () => {
    const rows = await withGlobalTenant(async (tx) => {
      const result = await tx.execute(sql`
        SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename IN ('accounting_entries', 'accounting_journal_lines', 'finance_invoices')
      `);
      return (result.rows as Array<{ indexname: string }>).map((row) => row.indexname);
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        "accounting_entries_workspace_status_date_active_idx",
        "accounting_lines_workspace_entry_idx",
        "accounting_journal_lines_covering_idx",
        "finance_invoices_workspace_status_due_active_idx",
      ]),
    );
  });
});

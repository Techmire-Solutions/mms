import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  accountingAccounts,
  accountingEntries,
  accountingJournalLines,
  workspaces,
} from "../../db/schema.js";
import { saveEntry } from "../../db/repositories/accountingEntriesPersist.js";
import type { JournalEntry } from "@mms/shared";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Database-level guards for the ledger (migration 0248).
 *
 * The application already refuses to archive or edit a posted entry, but that is
 * one function deep: any new repository, import, ops script or raw statement
 * could take a posted entry out of the ledger with no reversal. These tests pin
 * the database itself, and the `app.allow_hard_purge` escape the workspace purge
 * and backup-restore paths rely on.
 */
const TENANT = "accounting-posted-guards";

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

function entry(fields: Partial<JournalEntry> & { id: string }): JournalEntry {
  return {
    date: "2026-04-01",
    ref: `REF-${fields.id}`,
    description: "",
    status: "draft",
    created_by: "u1",
    fiscal_year: "FY2026",
    tags: [],
    attachments: [],
    lines: [],
    ...fields,
  } as JournalEntry;
}

/**
 * Drizzle wraps driver errors, so the trigger's message lives on `cause`.
 * Assert the guard text wherever it appears rather than matching the wrapper.
 */
async function expectGuardFailure(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const err = error as { message?: string; cause?: { message?: string } };
    const text = `${err.message ?? ""} ${err.cause?.message ?? ""}`;
    expect(text).toMatch(pattern);
    return;
  }
  throw new Error("expected the ledger guard to reject the write");
}

const balancedLines = (tag: string) => [
  { id: `${tag}-d`, account_id: "acc-cash", debit: 10, credit: 0, description: "" },
  { id: `${tag}-c`, account_id: "acc-income", debit: 0, credit: 10, description: "" },
];

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Posted guards", enabled: true });
    await tx.insert(accountingAccounts).values([
      { id: "acc-cash", workspaceSubdomain: TENANT, code: "1000", name: "Cash", type: "Asset" },
      {
        id: "acc-income",
        workspaceSubdomain: TENANT,
        code: "4000",
        name: "Income",
        type: "Revenue",
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

describe("posted journal entries cannot be silently archived (Postgres)", () => {
  it("promotes a draft to posted while rewriting its lines", async () => {
    // Regression for the ordering rule: children are cleared while the parent is
    // still `draft`, so a legitimate draft→posted save is not blocked by the
    // journal-line guard.
    await saveEntry(TENANT, entry({ id: "e-promote", lines: balancedLines("old") }));
    await saveEntry(
      TENANT,
      entry({ id: "e-promote", status: "posted", lines: balancedLines("new") }),
    );

    const rows = await withTenant(TENANT, (tx) =>
      tx
        .select({ id: accountingJournalLines.id })
        .from(accountingJournalLines)
        .where(eq(accountingJournalLines.entryId, "e-promote")),
    );
    expect(rows.map((r) => r.id).sort()).toEqual(["new-c", "new-d"]);
  });

  it("refuses to soft-delete a posted entry, even through raw SQL", async () => {
    await expectGuardFailure(
      withTenant(TENANT, (tx) =>
        tx
          .update(accountingEntries)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(accountingEntries.workspaceSubdomain, TENANT),
              eq(accountingEntries.id, "e-promote"),
            ),
          ),
      ),
      /Posted journal entry/,
    );
  });

  it("refuses to delete the lines of a posted entry", async () => {
    await expectGuardFailure(
      withTenant(TENANT, (tx) =>
        tx
          .delete(accountingJournalLines)
          .where(
            and(
              eq(accountingJournalLines.workspaceSubdomain, TENANT),
              eq(accountingJournalLines.entryId, "e-promote"),
            ),
          ),
      ),
      /immutable/,
    );
  });

  it("still allows archiving a draft entry", async () => {
    await saveEntry(TENANT, entry({ id: "e-draft", lines: balancedLines("draft") }));
    await withTenant(TENANT, (tx) =>
      tx
        .update(accountingEntries)
        .set({ deletedAt: new Date(), deletedBy: "u1" })
        .where(
          and(
            eq(accountingEntries.workspaceSubdomain, TENANT),
            eq(accountingEntries.id, "e-draft"),
          ),
        ),
    );

    const rows = await withTenant(TENANT, (tx) =>
      tx
        .select({ deletedAt: accountingEntries.deletedAt })
        .from(accountingEntries)
        .where(eq(accountingEntries.id, "e-draft")),
    );
    expect(rows[0]?.deletedAt).not.toBeNull();
  });

  it("keeps the maintenance escape the purge and restore paths use", async () => {
    await withTenant(TENANT, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx
        .update(accountingEntries)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(accountingEntries.workspaceSubdomain, TENANT),
            eq(accountingEntries.id, "e-promote"),
          ),
        );
      await tx
        .delete(accountingJournalLines)
        .where(
          and(
            eq(accountingJournalLines.workspaceSubdomain, TENANT),
            eq(accountingJournalLines.entryId, "e-promote"),
          ),
        );
    });

    const rows = await withTenant(TENANT, (tx) =>
      tx
        .select({ deletedAt: accountingEntries.deletedAt })
        .from(accountingEntries)
        .where(eq(accountingEntries.id, "e-promote")),
    );
    expect(rows[0]?.deletedAt).not.toBeNull();
  });
});

describe("ledger and directory indexes are reproducible (0248)", () => {
  it("has the accounting indexes the migration declares", async () => {
    const expected = [
      "accounting_entries_workspace_created_active_idx",
      "accounting_entries_workspace_status_date_active_idx",
      "accounting_journal_lines_covering_idx",
    ];
    const rows = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public' AND indexname = ANY(${sql.raw(
           `ARRAY[${expected.map((name) => `'${name}'`).join(",")}]::text[]`,
         )})
      `),
    );
    expect((rows.rows as Array<{ indexname: string }>).map((r) => r.indexname).sort()).toEqual(
      [...expected].sort(),
    );
  });

  it("provisioned the finance directory indexes at boot", async () => {
    // These are created CONCURRENTLY by db/migrations/financeConcurrentIndexes.ts
    // (finance_invoices/finance_payments are large tables), so this proves the
    // boot step ran — they are in no migration by design.
    const expected = [
      "finance_invoices_workspace_created_active_idx",
      "finance_payments_workspace_created_active_idx",
      "finance_invoices_workspace_student_period_active_idx",
    ];
    const rows = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public' AND indexname = ANY(${sql.raw(
           `ARRAY[${expected.map((name) => `'${name}'`).join(",")}]::text[]`,
         )})
      `),
    );
    expect((rows.rows as Array<{ indexname: string }>).map((r) => r.indexname).sort()).toEqual(
      [...expected].sort(),
    );
  });
});

describe("posted vouchers cannot be renumbered (0253)", () => {
  it("refuses to change the ref of a posted entry, even through raw SQL", async () => {
    await saveEntry(
      TENANT,
      entry({ id: "e-renumber", ref: "JE-0001", status: "posted", lines: balancedLines("renum") }),
    );
    await expectGuardFailure(
      withTenant(TENANT, (tx) =>
        tx.execute(sql`UPDATE accounting_entries SET ref = 'JE-0002' WHERE id = 'e-renumber'`),
      ),
      /immutable/,
    );
  });

  it("refuses to rewrite the reversal pointer of a posted entry", async () => {
    await expectGuardFailure(
      withTenant(TENANT, (tx) =>
        tx.execute(
          sql`UPDATE accounting_entries SET reversed_ref = 'JE-9999' WHERE id = 'e-renumber'`,
        ),
      ),
      /immutable/,
    );
  });

  it("still allows the ledger-maintenance escape the backfill uses", async () => {
    await withTenant(TENANT, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_ledger_maintenance = 'true'`);
      await tx.execute(sql`UPDATE accounting_entries SET ref = 'JE-0001' WHERE id = 'e-renumber'`);
    });
    const [row] = await withTenant(TENANT, (tx) =>
      tx.select().from(accountingEntries).where(eq(accountingEntries.id, "e-renumber")),
    );
    expect(row?.ref).toBe("JE-0001");
  });
});

describe("schema objects 0253 depends on", () => {
  it("keeps the hierarchy, archive and restore guards installed", async () => {
    const expected = [
      "trg_accounting_accounts_hierarchy_guard",
      "trg_accounting_accounts_config_archive_guard",
      "trg_accounting_accounts_restore_attribution",
      "trg_accounting_entries_restore_attribution",
    ];
    const rows = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT t.tgname FROM pg_trigger t
          JOIN pg_class c ON c.oid = t.tgrelid
         WHERE NOT t.tgisinternal
           AND t.tgname = ANY(${sql.raw(`ARRAY[${expected.map((n) => `'${n}'`).join(",")}]::text[]`)})
      `),
    );
    expect((rows.rows as Array<{ tgname: string }>).map((r) => r.tgname).sort()).toEqual(
      [...expected].sort(),
    );
  });

  it("has the indexes the 0253 migration declares", async () => {
    const expected = [
      "accounting_entries_workspace_ref_idx",
      "accounting_entries_workspace_date_active_idx",
      "accounting_accounts_workspace_parent_active_idx",
      "accounting_accounts_workspace_code_active_uidx",
      "accounting_accounts_workspace_type_active_idx",
      "accounting_accounts_workspace_created_active_idx",
      "accounting_fiscal_years_workspace_created_active_idx",
      "accounting_entry_tags_workspace_tag_idx",
    ];
    const rows = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public' AND indexname = ANY(${sql.raw(
           `ARRAY[${expected.map((name) => `'${name}'`).join(",")}]::text[]`,
         )})
      `),
    );
    expect((rows.rows as Array<{ indexname: string }>).map((r) => r.indexname).sort()).toEqual(
      [...expected].sort(),
    );
  });

  it("pins the posting-period status to the shared enum", async () => {
    const rows = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT pg_get_constraintdef(oid) AS definition
          FROM pg_constraint
         WHERE conname = 'accounting_posting_periods_status_check'
      `),
    );
    const definition = (rows.rows as Array<{ definition: string }>)[0]?.definition ?? "";
    expect(definition).toContain("'open'");
    expect(definition).toContain("'closed'");
  });
});

describe("0253 index shapes match the queries they support", () => {
  it("keeps the active partial predicates the list builders filter on", async () => {
    const rows = await withTenant(TENANT, (tx) =>
      tx.execute(sql`
        SELECT indexname, indexdef FROM pg_indexes
         WHERE schemaname = 'public'
           AND indexname IN (
             'accounting_entries_workspace_date_active_idx',
             'accounting_accounts_workspace_type_active_idx',
             'accounting_accounts_workspace_code_active_uidx',
             'accounting_entry_tags_workspace_tag_idx',
             'accounting_entries_workspace_ref_idx'
           )
      `),
    );
    const defs = new Map(
      (rows.rows as Array<{ indexname: string; indexdef: string }>).map((row) => [
        row.indexname,
        row.indexdef,
      ]),
    );
    // The readers always filter `deleted_at IS NULL`, so the index must carry it —
    // a non-partial index cannot serve that shape as cheaply.
    expect(defs.get("accounting_entries_workspace_date_active_idx")).toContain(
      "deleted_at IS NULL",
    );
    expect(defs.get("accounting_accounts_workspace_type_active_idx")).toContain(
      "deleted_at IS NULL",
    );
    // Recyclable uniqueness: the code is unique only among active accounts.
    expect(defs.get("accounting_accounts_workspace_code_active_uidx")).toContain("UNIQUE");
    expect(defs.get("accounting_accounts_workspace_code_active_uidx")).toContain(
      "deleted_at IS NULL",
    );
    // The voucher probe filters `ref = ANY(...)` without a `deleted_at` predicate,
    // so it needs a non-partial index.
    const refIndex = defs.get("accounting_entries_workspace_ref_idx") ?? "";
    expect(refIndex).toContain("ref");
    expect(refIndex).not.toContain("WHERE");
    // The tag filter probes by tag and only needs the entry id back.
    expect(defs.get("accounting_entry_tags_workspace_tag_idx")).toContain("entry_id");
  });
});

describe("preparer attribution is frozen on a posted voucher (0254)", () => {
  it("refuses to rewrite created_by of a posted entry", async () => {
    // Attribution is evidence, not editable metadata: an edit that renames the preparer
    // would falsify who posted the voucher.
    await expectGuardFailure(
      withTenant(TENANT, (tx) =>
        tx.execute(
          sql`UPDATE accounting_entries SET created_by = 'someone-else' WHERE id = 'e-renumber'`,
        ),
      ),
      /immutable/,
    );
  });
});

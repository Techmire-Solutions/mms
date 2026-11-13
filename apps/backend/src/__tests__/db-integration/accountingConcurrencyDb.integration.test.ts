import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { JournalEntry } from "@mms/shared";
import {
  activeDb,
  beginLongLivedTenantTransaction,
  closeDatabase,
  withActiveTransaction,
} from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import { accountingAccounts, accountingFiscalYears, workspaces } from "../../db/schema.js";
import { accountingRepository } from "../../accounting/repository/accountingRepositoryAdapter.js";
import { createAccountingUseCases } from "../../accounting/use-cases/accountingUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { reverseJournalEntry } from "../../accounting/use-cases/reverseJournalEntryUseCase.js";
import { reverseJournalEntryDeps } from "../../accounting/use-cases/reverseJournalEntryDeps.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const tenant = "accounting-concurrency-regression";
let available = false;
const draft: JournalEntry = {
  id: "concurrent-entry",
  date: "2026-03-01",
  status: "draft",
  ref: "test",
  description: "Draft",
  created_by: "test",
  fiscal_year: "",
  tags: [],
  attachments: [],
  lines: [
    { id: "debit", account_id: "cash", debit: 100, credit: 0, description: "" },
    { id: "credit", account_id: "income", debit: 0, credit: 100, description: "" },
  ],
};

beforeAll(async () => {
  await requireDatabaseConnection();
  available = true;
  await withTenant(tenant, async (tx) => {
    await tx.insert(workspaces).values({
      id: tenant,
      subdomain: tenant,
      madrasaName: "Accounting concurrency test",
      enabled: true,
    });
    await tx.insert(accountingAccounts).values([
      { id: "cash", workspaceSubdomain: tenant, code: "1000", name: "Cash", type: "Asset" },
      { id: "income", workspaceSubdomain: tenant, code: "4000", name: "Income", type: "Revenue" },
    ]);
  });
});

afterAll(async () => {
  try {
    if (available) {
      await withTenant(tenant, async (tx) => {
        await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
        await tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
      });
    }
  } finally {
    await closeDatabase();
  }
});

describe("accounting concurrent writes (Postgres)", () => {
  it("rejects a stale draft save after another transaction posts the journal", async () => {
    const useCases = createAccountingUseCases();
    await runWithTenant(tenant, () => useCases.upsertEntries([draft]));
    const posting = await beginLongLivedTenantTransaction(tenant);
    let competing: Promise<unknown> | undefined;
    let competingPid = 0;
    const competitor = createAccountingUseCases({
      ...accountingRepository,
      lockJournalEntries: async (workspace, ids) => {
        const result = await activeDb().execute<{ pid: number }>(
          sql`SELECT pg_backend_pid() AS pid`,
        );
        competingPid = result.rows[0].pid;
        await accountingRepository.lockJournalEntries(workspace, ids);
      },
    });
    try {
      await withActiveTransaction(posting.tx, () =>
        runWithTenant(tenant, () =>
          useCases.upsertEntries([{ ...draft, status: "posted", description: "Posted" }]),
        ),
      );
      competing = runWithTenant(tenant, () =>
        competitor.upsertEntries([{ ...draft, description: "Stale draft update" }]),
      ).then(
        () => "unexpected success",
        (error: unknown) => error,
      );
      await expect.poll(() => competingPid).toBeGreaterThan(0);
      await expect
        .poll(async () => {
          const result = await posting.tx.execute<{ waiting: boolean }>(sql`
          SELECT EXISTS (
            SELECT 1 FROM pg_locks WHERE pid = ${competingPid} AND locktype = 'advisory' AND NOT granted
          ) AS waiting
        `);
          return result.rows[0].waiting;
        })
        .toBe(true);
      await posting.commit();
      expect(await competing).toMatchObject({
        statusCode: 422,
        message: expect.stringContaining("immutable"),
      });
      const saved = await runWithTenant(tenant, () => useCases.loadEntryById(draft.id));
      expect(saved).toMatchObject({ status: "posted", description: "Posted", lines: draft.lines });
    } finally {
      await posting.rollback();
      await competing;
    }
  });

  it("serializes creation of the same new ID and rejects changed content", async () => {
    const useCases = createAccountingUseCases();
    const first = {
      ...draft,
      id: "concurrent-create",
      ref: "concurrent-create-ref",
      status: "posted" as const,
    };
    const results = await runWithTenant(tenant, () =>
      Promise.allSettled([
        useCases.createJournalEntry(first),
        useCases.createJournalEntry({ ...first, description: "Different salary note" }),
      ]),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ status: "rejected", reason: { statusCode: 409 } });
  });

  it("rejects creating another active journal entry with the same ref in the same workspace", async () => {
    const useCases = createAccountingUseCases();
    const uniqueRef = "JE-UNIQUE-TEST";
    await runWithTenant(tenant, () =>
      useCases.createJournalEntry({
        ...draft,
        id: "entry-ref-1",
        ref: uniqueRef,
        status: "posted",
      }),
    );

    await expect(
      runWithTenant(tenant, () =>
        useCases.createJournalEntry({
          ...draft,
          id: "entry-ref-2",
          ref: uniqueRef,
          status: "posted",
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("executes deduplication PL/pgSQL block without syntax or runtime error", async () => {
    await withTenant(tenant, async (tx) => {
      await tx.execute(sql`
        DO $$
        DECLARE
          dup_record RECORD;
          new_ref TEXT;
          counter INT;
        BEGIN
          FOR dup_record IN
            SELECT "workspace_subdomain", "id", "ref"
            FROM (
              SELECT
                "workspace_subdomain",
                "id",
                "ref",
                ROW_NUMBER() OVER (
                  PARTITION BY "workspace_subdomain", "ref"
                  ORDER BY "created_at" ASC, "id" ASC
                ) AS rn
              FROM "accounting_entries"
              WHERE "deleted_at" IS NULL
                AND "ref" IS NOT NULL
                AND "ref" <> ''
            ) sub
            WHERE sub.rn > 1
          LOOP
            counter := 1;
            LOOP
              new_ref := SUBSTRING(dup_record."ref", 1, 80) || '-dup-' || counter;
              EXIT WHEN NOT EXISTS (
                SELECT 1
                FROM "accounting_entries"
                WHERE "workspace_subdomain" = dup_record."workspace_subdomain"
                  AND "ref" = new_ref
                  AND "deleted_at" IS NULL
              );
              counter := counter + 1;
            END LOOP;

            UPDATE "accounting_entries"
            SET "ref" = new_ref
            WHERE "workspace_subdomain" = dup_record."workspace_subdomain"
              AND "id" = dup_record."id";
          END LOOP;
        END $$;
      `);
    });
  });

  it("commits concurrent balanced postings without duplicates or imbalance", async () => {
    const useCases = createAccountingUseCases();
    const batches: Promise<unknown>[] = [];
    for (let index = 0; index < 8; index += 1) {
      batches.push(
        runWithTenant(TENANT_REF(), () =>
          useCases.upsertEntries([
            {
              ...draft,
              id: `parallel-${index}`,
              ref: `PAR-${index}`,
              status: "posted",
              description: `Parallel ${index}`,
            },
          ]),
        ),
      );
    }
    await Promise.all(batches);

    const stored = await withTenant(TENANT_REF(), (tx) =>
      tx.execute(sql`
        SELECT count(*)::int AS entries,
               count(DISTINCT ref)::int AS refs,
               COALESCE((SELECT SUM(debit) - SUM(credit)
                           FROM accounting_journal_lines
                          WHERE workspace_subdomain = ${TENANT_REF()}), 0)::numeric AS net
          FROM accounting_entries
         WHERE workspace_subdomain = ${TENANT_REF()}
           AND id LIKE 'parallel-%'
      `),
    );
    const row = stored.rows[0] as { entries: number; refs: number; net: string };
    expect(row.entries).toBe(8);
    expect(row.refs).toBe(8);
    // Balanced to the cent, not merely "all writes succeeded".
    expect(Number(row.net)).toBe(0);
  });

  it("does not deadlock when two batches lock the same entries in opposite order", async () => {
    // `lockJournalEntries` sorts the advisory keys in SQL. Without that, a batch
    // saving [A,B] and a batch saving [B,A] would acquire the same two locks in
    // opposite order and Postgres would abort one with 40P01.
    const useCases = createAccountingUseCases();
    const entryWith = (id: string, ref: string): JournalEntry => ({
      ...draft,
      id,
      ref,
      status: "posted",
      description: `Opposite order ${id}`,
    });

    const forward = runWithTenant(TENANT_REF(), () =>
      useCases.upsertEntries([entryWith("order-a", "ORD-A"), entryWith("order-b", "ORD-B")]),
    );
    const reverse = runWithTenant(TENANT_REF(), () =>
      useCases.upsertEntries([entryWith("order-c", "ORD-C"), entryWith("order-d", "ORD-D")]),
    );
    const results = await Promise.allSettled([forward, reverse]);

    for (const result of results) {
      // A regression surfaces as the Postgres deadlock code, not "flaky".
      if (result.status === "rejected") throw result.reason;
    }

    const stored = await withTenant(TENANT_REF(), (tx) =>
      tx.execute(sql`
        SELECT count(*)::int AS entries,
               COALESCE((SELECT SUM(debit) - SUM(credit)
                           FROM accounting_journal_lines
                          WHERE workspace_subdomain = ${TENANT_REF()}), 0)::numeric AS net
          FROM accounting_entries
         WHERE workspace_subdomain = ${TENANT_REF()}
           AND id IN ('order-a', 'order-b', 'order-c', 'order-d')
      `),
    );
    const row = stored.rows[0] as { entries: number; net: string };
    expect(row.entries).toBe(4);
    expect(Number(row.net)).toBe(0);
  });

  it("reverses a posted entry exactly once when two reversals race", async () => {
    const useCases = createAccountingUseCases();
    await withTenant(TENANT_REF(), (tx) =>
      tx.insert(accountingFiscalYears).values({
        id: "fy-reversal",
        workspaceSubdomain: TENANT_REF(),
        label: "FY 2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "active",
      }),
    );
    const original = { ...draft, id: "reverse-me", ref: "REV-ME", status: "posted" as const };
    await runWithTenant(TENANT_REF(), () => useCases.upsertEntries([original]));

    const results = await Promise.allSettled([
      runWithTenant(TENANT_REF(), () =>
        reverseJournalEntry(
          TENANT_REF(),
          original.id,
          { date: "2026-03-05", reason: "duplicate reversal" },
          { id: "user-1" },
          reverseJournalEntryDeps,
        ),
      ),
      runWithTenant(TENANT_REF(), () =>
        reverseJournalEntry(
          TENANT_REF(),
          original.id,
          { date: "2026-03-05", reason: "duplicate reversal" },
          { id: "user-2" },
          reverseJournalEntryDeps,
        ),
      ),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const reversals = await withTenant(TENANT_REF(), (tx) =>
      tx.execute(sql`
        SELECT count(*)::int AS n FROM accounting_entries
         WHERE workspace_subdomain = ${TENANT_REF()}
           AND source_type = 'reversal' AND source_id = ${original.id}
      `),
    );
    expect((reversals.rows[0] as { n: number }).n).toBe(1);
  });
});

/** The suite's tenant constant (kept in one place for the added tests). */
function TENANT_REF(): string {
  return tenant;
}

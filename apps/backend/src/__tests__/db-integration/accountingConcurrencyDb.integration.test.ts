import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import type { JournalEntry } from "@mms/shared";
import {
  activeDb,
  beginLongLivedTenantTransaction,
  closeDatabase,
  initializeDatabaseConnection,
  pingDatabase,
  withActiveTransaction,
} from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import { accountingAccounts, workspaces } from "../../db/schema.js";
import { accountingRepository } from "../../accounting/repository/accountingRepositoryAdapter.js";
import { createAccountingUseCases } from "../../accounting/use-cases/accountingUseCases.js";
import { runWithTenant } from "../../lib/tenantContext.js";

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
  if (!process.env.DATABASE_URL) {
    const env = readFileSync(new URL("../../../.env", import.meta.url), "utf8");
    const match = env.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?$/m);
    if (match) process.env.DATABASE_URL = match[1].trim();
  }
  initializeDatabaseConnection();
  available = await pingDatabase();
  if (!available)
    throw new Error("PostgreSQL is required for the accounting concurrency regression");
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
});

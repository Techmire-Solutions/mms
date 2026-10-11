import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import {
  DEFAULT_CHART_CASH_ACCOUNT_CODE,
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_CHART_RETAINED_EARNINGS_CODE,
  type Account,
} from "@mms/shared";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import {
  accountingAccounts,
  accountingModulePreferences,
  accountingPostingRules,
  workspaces,
} from "../../db/schema.js";
import { seedAccountsIfEmpty } from "../../db/repositories/accountingAccountsSeed.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const WORKSPACES = ["coa-seed-fresh", "coa-seed-prefs", "coa-seed-race"];

type RootTx = Awaited<ReturnType<typeof beginLongLivedTenantTransaction>>["tx"];

async function asRoot(fn: (tx: RootTx) => Promise<void>): Promise<void> {
  const handle = await beginLongLivedTenantTransaction(null);
  try {
    await handle.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await fn(handle.tx);
    await handle.commit();
  } catch (error) {
    await handle.rollback().catch(() => undefined);
    throw error;
  }
}

async function resetWorkspaces(): Promise<void> {
  await asRoot(async (tx) => {
    await tx
      .delete(accountingPostingRules)
      .where(inArray(accountingPostingRules.workspaceSubdomain, WORKSPACES));
    await tx
      .delete(accountingModulePreferences)
      .where(inArray(accountingModulePreferences.workspaceSubdomain, WORKSPACES));
    await tx
      .delete(accountingAccounts)
      .where(inArray(accountingAccounts.workspaceSubdomain, WORKSPACES));
    await tx.delete(workspaces).where(inArray(workspaces.subdomain, WORKSPACES));
  });
}

const chartRecords = (): Account[] =>
  DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
    ...account,
    id: `a${randomUUID()}`,
    isActive: true,
  }));

const defaultsFor = (records: Account[]) => ({
  retainedEarningsAccountId: records.find((r) => r.code === DEFAULT_CHART_RETAINED_EARNINGS_CODE)
    ?.id,
  cashAccountId: records.find((r) => r.code === DEFAULT_CHART_CASH_ACCOUNT_CODE)?.id,
});

async function readState(subdomain: string) {
  const handle = await beginLongLivedTenantTransaction(null);
  try {
    const accounts = await handle.tx.$count(
      accountingAccounts,
      eq(accountingAccounts.workspaceSubdomain, subdomain),
    );
    const rules = await handle.tx
      .select({ cashAccountId: accountingPostingRules.cashAccountId })
      .from(accountingPostingRules)
      .where(eq(accountingPostingRules.workspaceSubdomain, subdomain));
    const prefs = await handle.tx
      .select({ preferences: accountingModulePreferences.preferences })
      .from(accountingModulePreferences)
      .where(eq(accountingModulePreferences.workspaceSubdomain, subdomain));
    return {
      accounts,
      cashAccountId: rules[0]?.cashAccountId ?? null,
      preferences: prefs[0]?.preferences ?? null,
    };
  } finally {
    await handle.rollback().catch(() => undefined);
  }
}

beforeAll(async () => {
  await requireDatabaseConnection();
});

beforeEach(async () => {
  await resetWorkspaces();
  await asRoot(async (tx) => {
    await tx.insert(workspaces).values(
      WORKSPACES.map((subdomain) => ({
        id: `ws-${subdomain}`,
        subdomain,
        madrasaName: subdomain,
        enabled: true,
      })),
    );
  });
});

afterAll(async () => {
  await resetWorkspaces();
  await closeDatabase();
});

describe("seedAccountsIfEmpty (PostgreSQL)", () => {
  it("seeds the chart and fills both unset settings in one transaction", async () => {
    const records = chartRecords();
    const defaults = defaultsFor(records);

    const result = await seedAccountsIfEmpty("coa-seed-fresh", records, defaults);

    expect(result).toEqual({
      seeded: true,
      count: DEFAULT_CHART_OF_ACCOUNTS.length,
      defaultsApplied: { retainedEarnings: true, cashAccount: true },
    });
    const state = await readState("coa-seed-fresh");
    expect(state.accounts).toBe(DEFAULT_CHART_OF_ACCOUNTS.length);
    expect(state.cashAccountId).toBe(defaults.cashAccountId);
    expect(state.preferences?.retainedEarningsAccount).toBe(defaults.retainedEarningsAccountId);
  });

  it("refuses a second seed and changes nothing", async () => {
    await seedAccountsIfEmpty("coa-seed-fresh", chartRecords());
    const again = chartRecords();

    const result = await seedAccountsIfEmpty("coa-seed-fresh", again, defaultsFor(again));

    expect(result).toEqual({ seeded: false, existing: DEFAULT_CHART_OF_ACCOUNTS.length });
    const state = await readState("coa-seed-fresh");
    expect(state.accounts).toBe(DEFAULT_CHART_OF_ACCOUNTS.length);
    expect(state.cashAccountId).toBeNull();
  });

  it("replaces only a dangling retained-earnings key and keeps other preferences", async () => {
    await asRoot(async (tx) => {
      await tx.insert(accountingModulePreferences).values({
        workspaceSubdomain: "coa-seed-prefs",
        preferences: { currency: "USD", retainedEarningsAccount: "a3100" },
      });
      await tx.insert(accountingPostingRules).values({ workspaceSubdomain: "coa-seed-prefs" });
    });
    const records = chartRecords();
    const defaults = defaultsFor(records);

    const result = await seedAccountsIfEmpty("coa-seed-prefs", records, defaults);

    expect(result.seeded && result.defaultsApplied).toEqual({
      retainedEarnings: true,
      cashAccount: true,
    });
    const state = await readState("coa-seed-prefs");
    expect(state.preferences).toEqual({
      currency: "USD",
      retainedEarningsAccount: defaults.retainedEarningsAccountId,
    });
    expect(state.cashAccountId).toBe(defaults.cashAccountId);
  });

  it("lets exactly one of two concurrent seeds win", async () => {
    const first = chartRecords();
    const second = chartRecords();

    const results = await Promise.all([
      seedAccountsIfEmpty("coa-seed-race", first, defaultsFor(first)),
      seedAccountsIfEmpty("coa-seed-race", second, defaultsFor(second)),
    ]);

    expect(results.filter((result) => result.seeded)).toHaveLength(1);
    expect((await readState("coa-seed-race")).accounts).toBe(DEFAULT_CHART_OF_ACCOUNTS.length);
  });
});

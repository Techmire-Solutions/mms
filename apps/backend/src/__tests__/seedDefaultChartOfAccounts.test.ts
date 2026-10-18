import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CHART_CASH_ACCOUNT_CODE,
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_CHART_RETAINED_EARNINGS_CODE,
  type Account,
} from "@mms/shared";
import type { SeedAccountDefaults } from "../db/repositories/accountingAccountsSeed.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { ConflictError } from "../lib/httpErrors.js";
import { seedDefaultChartOfAccountsUseCase } from "../accounting/use-cases/seedDefaultChartOfAccounts.js";

describe("seedDefaultChartOfAccountsUseCase", () => {
  const applied = (retainedEarnings: boolean, cashAccount: boolean) => ({
    retainedEarnings,
    cashAccount,
  });

  it("seeds the full default chart with unique ids and broadcasts", async () => {
    const seed = vi.fn(
      async (_tenant: string, records: Account[], _defaults: SeedAccountDefaults) => ({
        seeded: true as const,
        count: records.length,
        defaultsApplied: applied(true, true),
      }),
    );
    const broadcast = vi.fn(async () => undefined);

    const result = await runWithTenant("acme", () =>
      seedDefaultChartOfAccountsUseCase({ seed, broadcast }),
    );

    expect(result.count).toBe(DEFAULT_CHART_OF_ACCOUNTS.length);
    const [tenant, records] = seed.mock.calls[0];
    expect(tenant).toBe("acme");
    expect(records.map((record) => record.code)).toEqual(
      DEFAULT_CHART_OF_ACCOUNTS.map((account) => account.code),
    );
    expect(new Set(records.map((record) => record.id)).size).toBe(records.length);
    expect(records.every((record) => record.isActive)).toBe(true);
    expect(broadcast).toHaveBeenCalledWith("accounting_accounts");
    expect(broadcast).toHaveBeenCalledWith("accounting");
    expect(result.defaultsApplied).toEqual(applied(true, true));
  });

  it("passes the seeded retained-earnings and cash account ids as defaults", async () => {
    const seed = vi.fn(
      async (_tenant: string, records: Account[], _defaults: SeedAccountDefaults) => ({
        seeded: true as const,
        count: records.length,
        defaultsApplied: applied(false, false),
      }),
    );
    const broadcast = vi.fn(async () => undefined);

    await runWithTenant("acme", () => seedDefaultChartOfAccountsUseCase({ seed, broadcast }));

    const [, records, defaults] = seed.mock.calls[0];
    const idOf = (code: string) => records.find((record) => record.code === code)?.id;
    expect(defaults).toEqual({
      retainedEarningsAccountId: idOf(DEFAULT_CHART_RETAINED_EARNINGS_CODE),
      cashAccountId: idOf(DEFAULT_CHART_CASH_ACCOUNT_CODE),
    });
    expect(defaults.retainedEarningsAccountId).toMatch(/^a[0-9a-f-]{36}$/);
    expect(broadcast).not.toHaveBeenCalledWith("accounting");
  });

  it("refuses with a conflict and does not broadcast when accounts already exist", async () => {
    const seed = vi.fn(async () => ({ seeded: false as const, existing: 3 }));
    const broadcast = vi.fn(async () => undefined);

    await expect(
      runWithTenant("acme", () => seedDefaultChartOfAccountsUseCase({ seed, broadcast })),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("requires a tenant context", async () => {
    const seed = vi.fn();
    await expect(
      runWithTenant(null, () => seedDefaultChartOfAccountsUseCase({ seed })),
    ).rejects.toThrow("Tenant context required");
    expect(seed).not.toHaveBeenCalled();
  });
});

import { randomUUID } from "node:crypto";
import {
  ACCOUNTING_MODULE_MANIFEST,
  DEFAULT_CHART_CASH_ACCOUNT_CODE,
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_CHART_RETAINED_EARNINGS_CODE,
  accountListSchema,
  type Account,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { broadcastCollection } from "../../lib/livePush.js";
import {
  seedAccountsIfEmpty,
  type SeedAccountDefaults,
  type SeedAccountsResult,
  type SeedDefaultsApplied,
} from "../../db/repositories/accountingAccountsSeed.js";

/** Module-preferences live-push key (see accountingPreferencesService). */
const ACCOUNTING_PREFERENCES_BROADCAST_KEY = "accounting";

export interface SeedDefaultChartDependencies {
  seed?: (
    tenant: string,
    records: Account[],
    defaults: SeedAccountDefaults,
  ) => Promise<SeedAccountsResult>;
  broadcast?: (collection: string) => Promise<void>;
}

/**
 * Seeds the default Chart of Accounts into an empty workspace. Refuses with a
 * 409 when any account row exists, so it never modifies or duplicates an
 * existing chart — including one created concurrently by another user.
 * Retained earnings and the cash posting account are filled only when unset.
 */
export async function seedDefaultChartOfAccountsUseCase(
  deps: SeedDefaultChartDependencies = {},
): Promise<{ count: number; defaultsApplied: SeedDefaultsApplied }> {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");

  const records = accountListSchema.parse(
    DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
      ...account,
      id: `a${randomUUID()}`,
      isActive: true,
    })),
  );
  const idByCode = new Map(records.map((record) => [record.code, record.id]));
  const result = await (deps.seed ?? seedAccountsIfEmpty)(tenant, records, {
    retainedEarningsAccountId: idByCode.get(DEFAULT_CHART_RETAINED_EARNINGS_CODE),
    cashAccountId: idByCode.get(DEFAULT_CHART_CASH_ACCOUNT_CODE),
  });
  if (!result.seeded) {
    throw new ConflictError(
      "A Chart of Accounts already exists for this workspace; default accounts were not seeded",
    );
  }
  const broadcast = deps.broadcast ?? broadcastCollection;
  await broadcast(ACCOUNTING_MODULE_MANIFEST.accountCollectionKey);
  if (result.defaultsApplied.retainedEarnings)
    await broadcast(ACCOUNTING_PREFERENCES_BROADCAST_KEY);
  return { count: result.count, defaultsApplied: result.defaultsApplied };
}

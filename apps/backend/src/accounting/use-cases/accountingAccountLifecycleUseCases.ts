import type { AccountingRepository } from "../repository/accountingRepository.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  accountListSchema,
  fiscalYearListSchema,
  dedupeTrimmedIds,
  type Account,
  type FiscalYear,
  type AccountingCommandMetricsSnapshot,
} from "@mms/shared";
import { upsertWithBroadcast } from "../../services/tenantBulkService.js";
import type { createGenericRelationalService } from "../../services/genericRelationalService.js";

type CrudService<T extends { id?: string | number }> = ReturnType<
  typeof createGenericRelationalService<T>
>;

export interface AccountingUseCasesDependencies {
  countActiveJournalLinesForAccount?: (tenant: string, accountId: string) => Promise<number>;
  countActiveJournalLinesForAccounts?: (
    tenant: string,
    accountIds: string[],
  ) => Promise<Map<string, number>>;
}

export async function assertFiscalYearWritesAllowed(
  repo: Pick<AccountingRepository, "findFiscalYearsByIds">,
  incoming: readonly FiscalYear[],
): Promise<void> {
  const tenant = getRequestTenant();
  if (!tenant || incoming.length === 0) return;
  const stored = await repo.findFiscalYearsByIds(
    tenant,
    dedupeTrimmedIds(incoming.map((year) => year.id)),
  );
  const storedById = new Map(stored.map((year) => [year.id, year]));
  for (const year of incoming) {
    if (year.deletedAt || year.deletedBy || year.deletionReason) {
      throw Object.assign(
        new Error("Fiscal year lifecycle fields cannot be changed through bulk saves"),
        { statusCode: 422, type: "validation_error" },
      );
    }
    const existing = storedById.get(year.id);
    const isClosed = year.status === "closed";
    if (existing?.status === "closed") {
      if (!isClosed) {
        throw Object.assign(
          new Error("A closed fiscal year cannot be reopened — post an adjustment instead"),
          { statusCode: 422, type: "validation_error" },
        );
      }
      if (existing.startDate !== year.startDate || existing.endDate !== year.endDate) {
        throw Object.assign(new Error("A closed fiscal year cannot have its date range changed"), {
          statusCode: 422,
          type: "validation_error",
        });
      }
      continue;
    }
    if (isClosed) {
      throw Object.assign(
        new Error("Fiscal years must be closed through the close-fiscal-year action"),
        { statusCode: 422, type: "validation_error" },
      );
    }
  }
}

export function upsertAccountsHelper(
  repo: Pick<AccountingRepository, "bulkSaveAccounts">,
  accounts: Account[],
) {
  return upsertWithBroadcast(
    accountListSchema,
    accounts,
    repo.bulkSaveAccounts,
    "accounting_accounts",
  );
}

export async function upsertFiscalYearsHelper(
  repo: Pick<AccountingRepository, "bulkSaveFiscalYears" | "findFiscalYearsByIds">,
  fiscalYears: FiscalYear[],
) {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  return withTenant(tenant, async () => {
    await assertFiscalYearWritesAllowed(repo, fiscalYears);
    return upsertWithBroadcast(
      fiscalYearListSchema,
      fiscalYears,
      repo.bulkSaveFiscalYears,
      "accounting_fiscal_years",
    );
  });
}

export async function deleteAccountByIdHelper(
  accountCrud: CrudService<Account>,
  getActiveCount: (tenant: string, accountId: string) => Promise<number>,
  id: string,
  deletedBy: string,
  deletionReason?: string,
): Promise<boolean> {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  const cleanId = id?.trim();
  if (!cleanId) return false;
  const activeCount = await getActiveCount(tenant, cleanId);
  if (activeCount > 0) {
    const err = new Error("Cannot archive account with active ledger entries");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }
  return accountCrud.deleteById(cleanId, deletedBy, deletionReason);
}

export async function bulkSoftDeleteAccountsHelper(
  accountCrud: CrudService<Account>,
  getActiveCounts: (tenant: string, accountIds: string[]) => Promise<Map<string, number>>,
  ids: string[],
  deletedBy: string,
  deletionReason?: string,
): Promise<{ succeeded: number; failed: number }> {
  const tenant = getRequestTenant();
  if (!tenant) return { succeeded: 0, failed: ids.length };
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return { succeeded: 0, failed: 0 };
  const activeCounts = await getActiveCounts(tenant, cleanIds);
  const blockedIds = new Set<string>();
  for (const [accId, count] of activeCounts.entries()) {
    if (count > 0) blockedIds.add(accId);
  }
  const allowedIds = cleanIds.filter((id) => !blockedIds.has(id));
  if (allowedIds.length === 0) {
    return { succeeded: 0, failed: cleanIds.length };
  }
  const result = await accountCrud.bulkDeleteByIds(allowedIds, deletedBy, deletionReason);
  return {
    succeeded: result.succeeded,
    failed: result.failed + blockedIds.size,
  };
}

export const EMPTY_ACCOUNTING_METRICS: AccountingCommandMetricsSnapshot = {
  totalEntries: 0,
  posted: 0,
  draft: 0,
  activeAccounts: 0,
  inactiveAccounts: 0,
  newThisPeriod: 0,
  postedVolume: 0,
  revenue: 0,
  expenses: 0,
  surplus: 0,
  assets: 0,
  liabilities: 0,
};

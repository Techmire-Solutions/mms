import type {
  AccountingListQuery,
  AccountingAccountsListPageResult,
  AccountingFiscalYearsListPageResult,
} from "@mms/shared";
import { accountingAccounts, accountingFiscalYears } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { runListPage } from "./listPageHelper.js";
import { accountRowToRecord, fiscalYearRowToRecord } from "./accountingRepository.js";
import {
  buildAccountListConditions,
  buildAccountOrderBy,
  buildFiscalYearListConditions,
  buildFiscalYearOrderBy,
} from "./accountingRepositoryListQuery.js";

export async function listAccountsPage(
  tenant: string,
  query: AccountingListQuery & { afterId?: string; skipCount?: boolean },
): Promise<AccountingAccountsListPageResult & { nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();

  return withTenantRead(subdomain, async (tx) => {
    const result = await runListPage(tx, accountingAccounts, {
      columns: {
        id: accountingAccounts.id,
        code: accountingAccounts.code,
        name: accountingAccounts.name,
        type: accountingAccounts.type,
        subtype: accountingAccounts.subtype,
        description: accountingAccounts.description,
        isActive: accountingAccounts.isActive,
        isMonetary: accountingAccounts.isMonetary,
        accountCurrency: accountingAccounts.accountCurrency,
        allowRevaluation: accountingAccounts.allowRevaluation,
        deletedAt: accountingAccounts.deletedAt,
        deletedBy: accountingAccounts.deletedBy,
        deletionReason: accountingAccounts.deletionReason,
        createdAt: accountingAccounts.createdAt,
        updatedAt: accountingAccounts.updatedAt,
      },
      conditions: buildAccountListConditions(subdomain, query),
      orderBy: buildAccountOrderBy(query.sortField, query.sortDir),
      page: query.page,
      limit: query.limit,
      afterId: query.afterId,
      skipCount: query.skipCount,
      defaultPageSize: 12,
      rowMapper: (row) => accountRowToRecord(row as typeof accountingAccounts.$inferSelect),
    });

    return {
      accounts: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  });
}

export async function listFiscalYearsPage(
  tenant: string,
  query: AccountingListQuery & { afterId?: string; skipCount?: boolean },
): Promise<AccountingFiscalYearsListPageResult & { nextCursor?: string }> {
  const subdomain = tenant.trim().toLowerCase();

  return withTenantRead(subdomain, async (tx) => {
    const result = await runListPage(tx, accountingFiscalYears, {
      columns: {
        id: accountingFiscalYears.id,
        label: accountingFiscalYears.label,
        startDate: accountingFiscalYears.startDate,
        endDate: accountingFiscalYears.endDate,
        status: accountingFiscalYears.status,
        deletedAt: accountingFiscalYears.deletedAt,
        deletedBy: accountingFiscalYears.deletedBy,
        deletionReason: accountingFiscalYears.deletionReason,
        createdAt: accountingFiscalYears.createdAt,
        updatedAt: accountingFiscalYears.updatedAt,
      },
      conditions: buildFiscalYearListConditions(subdomain, query),
      orderBy: buildFiscalYearOrderBy(query.sortField, query.sortDir),
      page: query.page,
      limit: query.limit,
      afterId: query.afterId,
      skipCount: query.skipCount,
      defaultPageSize: 12,
      rowMapper: (row) => fiscalYearRowToRecord(row as typeof accountingFiscalYears.$inferSelect),
    });

    return {
      fiscalYears: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  });
}

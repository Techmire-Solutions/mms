import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type Account } from "@mms/shared";
import { accountingAccounts } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { postedLineCountsByAccount } from "./accountingAccountLedgerLines.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";
import {
  saveAccount,
  bulkSaveAccounts,
  replaceAccountsForWorkspace,
  bulkSoftDeleteAccounts,
  bulkRestoreAccounts,
} from "./accountingAccountsPersist.js";

type AccountRow = typeof accountingAccounts.$inferSelect;

/**
 * The COA projection every reader selects. One definition so a new column cannot
 * be added to the table but forgotten in one of the three queries (which is
 * exactly how `parent_account_id` would have gone missing from the list view).
 */
export const accountSelectColumns = {
  id: accountingAccounts.id,
  workspaceSubdomain: accountingAccounts.workspaceSubdomain,
  code: accountingAccounts.code,
  name: accountingAccounts.name,
  type: accountingAccounts.type,
  subtype: accountingAccounts.subtype,
  description: accountingAccounts.description,
  isActive: accountingAccounts.isActive,
  parentAccountId: accountingAccounts.parentAccountId,
  isMonetary: accountingAccounts.isMonetary,
  accountCurrency: accountingAccounts.accountCurrency,
  allowRevaluation: accountingAccounts.allowRevaluation,
  deletedAt: accountingAccounts.deletedAt,
  deletedBy: accountingAccounts.deletedBy,
  deletionReason: accountingAccounts.deletionReason,
  restoredAt: accountingAccounts.restoredAt,
  restoredBy: accountingAccounts.restoredBy,
  deletedWithCascade: accountingAccounts.deletedWithCascade,
  createdAt: accountingAccounts.createdAt,
  updatedAt: accountingAccounts.updatedAt,
};

export function accountRowToRecord(row: AccountRow): Account {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type as Account["type"],
    subtype: row.subtype,
    description: row.description,
    isActive: row.isActive,
    parentId: row.parentAccountId ?? null,
    isMonetary: row.isMonetary,
    accountCurrency: row.accountCurrency,
    allowRevaluation: row.allowRevaluation,
    ...mapAuditTimestamps(row),
  };
}

export async function listAccountsByWorkspace(
  tenant: string,
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<Account[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const filter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
    const conditions = buildTenantSoftDeleteConditions(accountingAccounts, subdomain, filter);

    const rows = await tx
      .select(accountSelectColumns)
      .from(accountingAccounts)
      .where(and(...conditions));
    return rows.map(accountRowToRecord);
  });
}

export async function findAccountById(tenant: string, id: string): Promise<Account | null> {
  const trimmedId = id?.trim();
  if (!trimmedId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(accountSelectColumns)
      .from(accountingAccounts)
      .where(
        and(
          eq(accountingAccounts.workspaceSubdomain, subdomain),
          eq(accountingAccounts.id, trimmedId),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? accountRowToRecord(row) : null;
  });
}

export async function findAccountsByIds(
  tenant: string,
  ids: string[],
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<Account[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const filter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
    const conditions = [
      ...buildTenantSoftDeleteConditions(accountingAccounts, subdomain, filter),
      inArray(accountingAccounts.id, cleanIds),
    ];

    const rows = await tx
      .select(accountSelectColumns)
      .from(accountingAccounts)
      .where(and(...conditions));
    return rows.map(accountRowToRecord);
  });
}

/**
 * Active, posted ledger lines per account — the count an archive must respect.
 * Delegates to `accountingAccountGuards`, which owns the predicate and runs it on
 * the primary inside the caller's transaction (it used to read the replica, where
 * lag could hide a just-posted line).
 */
export async function countActiveJournalLinesForAccount(
  tenant: string,
  accountId: string,
): Promise<number> {
  const cleanId = accountId?.trim();
  if (!cleanId) return 0;
  const counts = await countActiveJournalLinesForAccounts(tenant, [cleanId]);
  return counts.get(cleanId) ?? 0;
}

export async function countActiveJournalLinesForAccounts(
  tenant: string,
  accountIds: string[],
): Promise<Map<string, number>> {
  const subdomain = tenant.trim().toLowerCase();
  const cleanIds = dedupeTrimmedIds(accountIds);
  if (cleanIds.length === 0) return new Map();
  return withTenant(subdomain, (tx) => postedLineCountsByAccount(tx, subdomain, cleanIds));
}

/** The account fields a posting guard needs; `hasChildren` marks a summary account. */
export interface PostableAccountLookup {
  id: string;
  isActive: boolean;
  hasChildren: boolean;
  /** IAS 21 account-level currency lock; every line on it must use this currency. */
  accountCurrency: string | null;
}

/** True when another active account is nested under this one (a header/summary row). */
const hasActiveChildren = (table: typeof accountingAccounts) =>
  sql<boolean>`exists (
    select 1 from ${accountingAccounts} child
     where child.workspace_subdomain = ${table.workspaceSubdomain}
       and child.parent_account_id = ${table.id}
       and child.deleted_at is null
  )`;

/**
 * Accounts a journal line may target, locked `FOR SHARE` on the primary.
 *
 * The lock is what closes deactivate/archive-versus-post: account archival takes
 * `FOR UPDATE`, so it waits for an in-flight posting, and the posting's own read
 * waits for a committed archive and then re-evaluates the `deleted_at IS NULL`
 * predicate. A read-only check in another transaction is insufficient (see
 * `mms-finance-accounting` ledger controls), which is what the previous
 * `findAccountsByIds` lookup was.
 */
export async function lockPostableAccounts(
  tenant: string,
  ids: string[],
): Promise<PostableAccountLookup[]> {
  const subdomain = tenant.trim().toLowerCase();
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: accountingAccounts.id,
        isActive: accountingAccounts.isActive,
        accountCurrency: accountingAccounts.accountCurrency,
        hasChildren: hasActiveChildren(accountingAccounts),
      })
      .from(accountingAccounts)
      .where(
        and(
          eq(accountingAccounts.workspaceSubdomain, subdomain),
          inArray(accountingAccounts.id, cleanIds),
          isNull(accountingAccounts.deletedAt),
        ),
      )
      .for("share");
    return rows.map((row) => ({ ...row, hasChildren: Boolean(row.hasChildren) }));
  });
}

/** Ids (from `ids`) that currently host active children — i.e. summary accounts. */
export async function findSummaryAccountIds(tenant: string, ids: string[]): Promise<Set<string>> {
  const subdomain = tenant.trim().toLowerCase();
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return new Set();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: accountingAccounts.id, hasChildren: hasActiveChildren(accountingAccounts) })
      .from(accountingAccounts)
      .where(
        and(
          eq(accountingAccounts.workspaceSubdomain, subdomain),
          inArray(accountingAccounts.id, cleanIds),
          isNull(accountingAccounts.deletedAt),
        ),
      );
    return new Set(rows.filter((row) => row.hasChildren).map((row) => row.id));
  });
}

export {
  saveAccount,
  bulkSaveAccounts,
  replaceAccountsForWorkspace,
  bulkSoftDeleteAccounts,
  bulkRestoreAccounts,
};

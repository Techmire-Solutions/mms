import { and, eq, inArray } from "drizzle-orm";
import type {
  Account,
  AuditActionType,
  BankReconciliationMatch,
  BankStatement,
  OpeningBalance,
  PostingRules,
} from "@mms/shared";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { accountingAccounts } from "../schema.js";
import type { AppDb, TenantTransaction } from "../tenant-context.js";

/**
 * Audit appends for the accounting surfaces that were previously unlogged.
 *
 * Each helper takes the **caller's transaction**, so the audit row commits or
 * rolls back with the mutation it describes (the atomicity contract proven in
 * `accountingAuditAtomicityDb`). States are minimised: identifiers, classification
 * and amounts only — free-text descriptions are excluded because callers write
 * names into them.
 */

type Tx = TenantTransaction | AppDb;

/** Chart-of-accounts state worth auditing (no free text, no audit columns). */
export interface AccountAuditState {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
  parentId: string | null;
  isActive: boolean;
  accountCurrency: string | null;
  isMonetary: boolean | null;
  allowRevaluation: boolean | null;
  deletedAt: string | null;
}

export function accountAuditState(account: Account): AccountAuditState {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    subtype: account.subtype ?? "",
    parentId: account.parentId ?? null,
    isActive: account.isActive !== false,
    accountCurrency: account.accountCurrency ?? null,
    isMonetary: account.isMonetary ?? null,
    allowRevaluation: account.allowRevaluation ?? null,
    deletedAt: account.deletedAt ?? null,
  };
}

export function accountStateChanged(
  next: AccountAuditState,
  previous: AccountAuditState | null | undefined,
): boolean {
  if (!previous) return true;
  return JSON.stringify(next) !== JSON.stringify(previous);
}

/** Audit-relevant account columns, read inside the caller's transaction. */
export async function readAccountAuditStates(
  tx: Tx,
  tenant: string,
  ids: readonly string[],
): Promise<Map<string, AccountAuditState>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await (tx as unknown as AppDb)
    .select({
      id: accountingAccounts.id,
      code: accountingAccounts.code,
      name: accountingAccounts.name,
      type: accountingAccounts.type,
      subtype: accountingAccounts.subtype,
      parentId: accountingAccounts.parentAccountId,
      isActive: accountingAccounts.isActive,
      accountCurrency: accountingAccounts.accountCurrency,
      isMonetary: accountingAccounts.isMonetary,
      allowRevaluation: accountingAccounts.allowRevaluation,
      deletedAt: accountingAccounts.deletedAt,
    })
    .from(accountingAccounts)
    .where(
      and(
        eq(accountingAccounts.workspaceSubdomain, tenant),
        inArray(accountingAccounts.id, unique),
      ),
    );
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        code: row.code,
        name: row.name,
        type: row.type,
        subtype: row.subtype ?? "",
        parentId: row.parentId ?? null,
        isActive: row.isActive !== false,
        accountCurrency: row.accountCurrency ?? null,
        isMonetary: row.isMonetary ?? null,
        allowRevaluation: row.allowRevaluation ?? null,
        deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      },
    ]),
  );
}

async function append(
  tx: Tx,
  input: {
    workspaceSubdomain: string;
    tableName: string;
    recordId: string;
    actionType: AuditActionType;
    oldState?: unknown;
    newState?: unknown;
  },
): Promise<void> {
  await recordModernAuditEvent(tx as unknown as AppDb, input);
}

/**
 * Audits the changed accounts of a create/update batch. Unchanged rows are skipped
 * so re-sending the whole chart (the bulk upsert the UI performs on every edit)
 * does not append one row per account.
 */
export async function auditAccountSaves(
  tx: Tx,
  tenant: string,
  saved: readonly Account[],
  previous: ReadonlyMap<string, AccountAuditState>,
): Promise<void> {
  for (const account of saved) {
    const next = accountAuditState(account);
    const before = previous.get(account.id) ?? null;
    if (!accountStateChanged(next, before)) continue;
    await append(tx, {
      workspaceSubdomain: tenant,
      tableName: "accounting_accounts",
      recordId: account.id,
      actionType: before ? "UPDATE" : "CREATE",
      oldState: before ?? undefined,
      newState: next,
    });
  }
}

/** Audits an archive (DELETE) or restore (UPDATE with `event`) per account. */
export async function auditAccountLifecycle(
  tx: Tx,
  tenant: string,
  before: ReadonlyMap<string, AccountAuditState>,
  action: "archive" | "restore",
  reason?: string,
): Promise<void> {
  for (const state of before.values()) {
    await append(tx, {
      workspaceSubdomain: tenant,
      tableName: "accounting_accounts",
      recordId: state.id,
      actionType: action === "archive" ? "DELETE" : "UPDATE",
      oldState: state,
      newState: {
        ...state,
        deletedAt: action === "archive" ? new Date().toISOString() : null,
        event: action === "archive" ? "account_archived" : "account_restored",
        ...(reason ? { reason } : {}),
      },
    });
  }
}

export async function auditPostingRulesSaved(
  tx: Tx,
  tenant: string,
  previous: PostingRules | null,
  next: PostingRules,
): Promise<void> {
  await append(tx, {
    workspaceSubdomain: tenant,
    tableName: "accounting_posting_rules",
    recordId: tenant,
    actionType: "UPDATE",
    oldState: previous,
    newState: next,
  });
}

export async function auditOpeningBalancesReplaced(
  tx: Tx,
  tenant: string,
  fiscalYearId: string,
  previous: readonly OpeningBalance[],
  next: readonly OpeningBalance[],
  reason?: string,
): Promise<void> {
  await append(tx, {
    workspaceSubdomain: tenant,
    tableName: "accounting_opening_balances",
    recordId: fiscalYearId,
    actionType: "UPDATE",
    oldState: previous,
    newState: { fiscalYearId, balances: next, ...(reason ? { reason } : {}) },
  });
}

export async function auditBankStatementSaved(
  tx: Tx,
  tenant: string,
  record: BankStatement,
  previous: BankStatement | null,
): Promise<void> {
  await append(tx, {
    workspaceSubdomain: tenant,
    tableName: "accounting_bank_statements",
    recordId: record.id,
    actionType: previous ? "UPDATE" : "CREATE",
    oldState: previous,
    newState: record,
  });
}

export async function auditBankReconciliationMatched(
  tx: Tx,
  tenant: string,
  match: BankReconciliationMatch,
  reason?: string,
): Promise<void> {
  await append(tx, {
    workspaceSubdomain: tenant,
    tableName: "accounting_bank_reconciliations",
    recordId: match.statementLineId,
    actionType: "CREATE",
    newState: { ...match, ...(reason ? { reason } : {}) },
  });
}

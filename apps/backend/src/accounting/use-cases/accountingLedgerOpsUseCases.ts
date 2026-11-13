import {
  bankReconciliationMatchSchema,
  bankStatementInsertSchema,
  bankStatementRecordSchema,
  openingBalancesReplaceSchema,
  postingRulesUpdateSchema,
  type BankStatement,
  type FiscalYear,
  type OpeningBalance,
  type OpeningBalanceInsert,
  type PostingRules,
  type PostingRulesUpdate,
} from "@mms/shared";
import { requireTenant } from "../../lib/tenantContext.js";
import {
  findAccountsByIds,
  findSummaryAccountIds,
} from "../../db/repositories/accountingAccountsRepository.js";
import {
  getPostingRules,
  listBankStatements,
  listOpeningBalances,
  matchBankReconciliation,
  replaceOpeningBalances,
  saveBankStatement,
  savePostingRules,
} from "../../db/repositories/accountingLedgerOpsRepository.js";
import { findFiscalYearById } from "../../db/repositories/accountingFiscalYearsRepository.js";
import { findActiveReversalOf } from "../../db/repositories/accountingEntryReversalRepository.js";
import { listOpeningEntries } from "../../db/repositories/accountingRepository.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { closeFiscalYearForTenant } from "./accountingPeriodClose.js";
import { assertAccountIdsPostable } from "./accountingLedgerGuards.js";
import { tryPostOpeningJournal } from "../ledgerPosting/ledgerPostingService.js";

async function broadcast(tenant: string, collection: string): Promise<void> {
  const { broadcastTenantUpdate } = await import("../../lib/livePush.js");
  broadcastTenantUpdate(tenant, "collection", collection);
}

/**
 * Which account type each posting role must point at.
 *
 * Without this, `incomeAccountId` could name an Expense account and every
 * subsequent invoice posting would classify revenue wrongly, with the Trial
 * Balance and Income Statement silently disagreeing and no error anywhere.
 * Archived accounts are rejected too: the FK only enforces existence, and
 * archiving is a soft delete, so an archived account passes it.
 */
const POSTING_RULE_ACCOUNT_TYPES = {
  arAccountId: ["Asset"],
  cashAccountId: ["Asset"],
  bankAccountId: ["Asset"],
  incomeAccountId: ["Revenue"],
  discountAccountId: ["Expense", "Revenue"],
  fxRealizedAccountId: ["Revenue", "Expense"],
  fxUnrealizedAccountId: ["Revenue", "Expense"],
  fxRoundingAccountId: ["Revenue", "Expense"],
  ctaAccountId: ["Equity"],
} as const satisfies Record<keyof PostingRulesUpdate, readonly string[]>;

export async function assertPostingRuleAccountsValid(
  tenant: string,
  rules: PostingRulesUpdate,
): Promise<void> {
  const configured = (
    Object.keys(POSTING_RULE_ACCOUNT_TYPES) as (keyof typeof POSTING_RULE_ACCOUNT_TYPES)[]
  )
    .map((field) => ({
      field,
      allowedTypes: POSTING_RULE_ACCOUNT_TYPES[field] as readonly string[],
      accountId: (rules[field] ?? "").trim(),
    }))
    .filter((row) => Boolean(row.accountId));
  if (configured.length === 0) return;

  const accounts = await findAccountsByIds(
    tenant,
    configured.map((row) => row.accountId),
  );
  const byId = new Map(accounts.map((account) => [account.id, account]));

  const problems: string[] = [];
  for (const { field, allowedTypes, accountId } of configured) {
    const account = byId.get(accountId);
    if (!account) {
      problems.push(`${field}: unknown or archived account "${accountId}"`);
      continue;
    }
    // A deactivated account is unavailable everywhere else in the module (the
    // pickers hide it and new postings are rejected), so it must not be
    // configurable as a posting destination either.
    if (account.isActive === false) {
      problems.push(`${field}: ${account.code} ${account.name} is deactivated`);
      continue;
    }
    if (!allowedTypes.includes(account.type)) {
      problems.push(
        `${field}: ${account.code} ${account.name} is type ${account.type}, expected ${allowedTypes.join(" or ")}`,
      );
    }
  }
  // A header/summary account aggregates its children; pointing a posting rule at one
  // would double-count the balance it already rolls up.
  const summaryIds = await findSummaryAccountIds(
    tenant,
    configured.map((row) => row.accountId),
  );
  for (const { field, accountId } of configured) {
    if (!summaryIds.has(accountId)) continue;
    const account = byId.get(accountId);
    problems.push(
      `${field}: ${account?.code ?? accountId} ${account?.name ?? ""} is a summary account with sub-accounts`,
    );
  }
  if (problems.length > 0) {
    throw Object.assign(new Error(`Invalid posting rules — ${problems.join("; ")}`), {
      statusCode: 422,
      type: "validation_error",
    });
  }
}

export async function loadPostingRules(): Promise<PostingRules> {
  return getPostingRules(requireTenant());
}

export async function upsertPostingRules(input: PostingRulesUpdate): Promise<PostingRules> {
  const tenant = requireTenant();
  const parsed = postingRulesUpdateSchema.parse(input);
  await assertPostingRuleAccountsValid(tenant, parsed);
  await savePostingRules(tenant, parsed);
  await broadcast(tenant, "accounting_posting_rules");
  return parsed;
}

export async function loadOpeningBalances(fiscalYearId: string): Promise<OpeningBalance[]> {
  return listOpeningBalances(requireTenant(), fiscalYearId);
}

export async function upsertOpeningBalances(
  fiscalYearId: string,
  balances: OpeningBalanceInsert[],
  reason?: string,
): Promise<OpeningBalance[]> {
  const tenant = requireTenant();
  // Editing opening balances after the year is closed (or after they were
  // posted) silently desynchronised the stored balances from the opening
  // journal, which can no longer be posted for that year.
  const year = await findFiscalYearById(tenant, fiscalYearId);
  if (!year) {
    throw Object.assign(new Error("Fiscal year not found"), {
      statusCode: 404,
      type: "not_found",
    });
  }
  if (year.status === "closed") {
    throw Object.assign(new Error("Cannot edit opening balances of a closed fiscal year"), {
      statusCode: 422,
      type: "validation_error",
    });
  }
  // Editing is allowed again once the posted opening entry has been reversed: the
  // re-post then writes a revision entry. Previously the reversal left the source
  // key in place, so the "reverse that entry" advice could never be followed.
  const latestOpening = (await listOpeningEntries(tenant, fiscalYearId)).at(-1);
  if (latestOpening && !(await findActiveReversalOf(tenant, latestOpening))) {
    throw Object.assign(
      new Error(
        "Opening balances for this fiscal year are already posted — reverse that entry before editing them",
      ),
      { statusCode: 422, type: "validation_error" },
    );
  }
  const parsed = openingBalancesReplaceSchema.parse({ fiscalYearId, balances, reason });
  // An opening balance parks an amount on an account; validate the account here so a
  // typo or an archived/deactivated/summary account is refused at edit time instead
  // of at posting time.
  await assertAccountIdsPostable(
    tenant,
    parsed.balances.map((row) => row.accountId),
    async (workspace, ids) => {
      const [accounts, summaryIds] = await Promise.all([
        findAccountsByIds(workspace, ids),
        findSummaryAccountIds(workspace, ids),
      ]);
      return accounts.map((account) => ({
        id: account.id,
        isActive: account.isActive,
        hasChildren: summaryIds.has(account.id),
      }));
    },
  );
  const records = parsed.balances.map((row, index) => ({
    ...row,
    id: row.id ?? `ob-${index + 1}`,
    fiscalYearId,
  }));
  await replaceOpeningBalances(tenant, fiscalYearId, records, parsed.reason);
  await broadcast(tenant, "accounting_opening_balances");
  return records;
}

export async function postOpeningBalances(fiscalYearId: string): Promise<{ posted: boolean }> {
  const tenant = requireTenant();
  const balances = await listOpeningBalances(tenant, fiscalYearId);
  // `posted: false` means the balances were already posted unchanged, so callers
  // can tell an idempotent replay from a real posting instead of assuming
  // success — previously an edited-but-already-posted set reported success while
  // the ledger kept the original figures.
  const entry = await tryPostOpeningJournal(tenant, fiscalYearId, balances);
  if (entry) {
    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: "accounting_entries",
      recordId: entry.id,
      actionType: "CREATE",
      newState: {
        event: "opening_balances_posted",
        fiscalYearId,
        sourceId: entry.source_id ?? fiscalYearId,
        lineCount: entry.lines?.length ?? 0,
      },
    });
  }
  await broadcast(tenant, "accounting_entries");
  return { posted: entry !== null };
}

export async function closeFiscalYear(
  fiscalYearId: string,
  closedBy: string,
  retainedEarningsAccountId?: string,
): Promise<FiscalYear> {
  const tenant = requireTenant();
  const closed = await closeFiscalYearForTenant(
    tenant,
    fiscalYearId,
    closedBy,
    retainedEarningsAccountId,
  );
  await broadcast(tenant, "accounting_fiscal_years");
  await broadcast(tenant, "accounting_entries");
  return closed;
}

export async function loadBankStatements(): Promise<BankStatement[]> {
  return listBankStatements(requireTenant());
}

export async function upsertBankStatement(input: unknown): Promise<BankStatement> {
  const tenant = requireTenant();
  const parsed = bankStatementInsertSchema.parse(input);
  const record = bankStatementRecordSchema.parse({
    ...parsed,
    id: parsed.id || `bs-${Date.now()}`,
    lines: (parsed.lines ?? []).map((line, index) => ({
      ...line,
      id: line.id ?? `bsl-${index + 1}`,
    })),
  });
  await saveBankStatement(tenant, record);
  await broadcast(tenant, "accounting_bank_statements");
  return record;
}

export async function matchBankStatementLine(input: unknown): Promise<void> {
  const tenant = requireTenant();
  const parsed = bankReconciliationMatchSchema.parse(input);
  await matchBankReconciliation(tenant, parsed, parsed.reason);
  await broadcast(tenant, "accounting_bank_reconciliations");
}

export {
  closePostingPeriod,
  loadPostingPeriods,
  reopenPostingPeriod,
} from "./accountingPostingPeriodUseCases.js";

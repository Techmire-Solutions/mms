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
import { findAccountsByIds } from "../../db/repositories/accountingAccountsRepository.js";
import {
  getPostingRules,
  listBankStatements,
  listOpeningBalances,
  matchBankReconciliation,
  replaceOpeningBalances,
  saveBankStatement,
  savePostingRules,
} from "../../db/repositories/accountingLedgerOpsRepository.js";
import { closeFiscalYearForTenant } from "./accountingPeriodClose.js";
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
): Promise<OpeningBalance[]> {
  const tenant = requireTenant();
  const parsed = openingBalancesReplaceSchema.parse({ fiscalYearId, balances });
  const records = parsed.balances.map((row, index) => ({
    ...row,
    id: row.id ?? `ob-${index + 1}`,
    fiscalYearId,
  }));
  await replaceOpeningBalances(tenant, fiscalYearId, records);
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
  await matchBankReconciliation(tenant, parsed);
  await broadcast(tenant, "accounting_bank_reconciliations");
}

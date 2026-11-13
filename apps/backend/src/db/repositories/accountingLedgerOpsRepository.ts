import { and, eq } from "drizzle-orm";
import type { OpeningBalance, PostingRules } from "@mms/shared";
import { accountingOpeningBalances, accountingPostingRules } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { auditOpeningBalancesReplaced, auditPostingRulesSaved } from "./accountingEntityAudit.js";
import { ensureCurrencySettingsInTx } from "./accountingCurrencySettingsRepository.js";

export async function getPostingRules(tenant: string): Promise<PostingRules> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        arAccountId: accountingPostingRules.arAccountId,
        cashAccountId: accountingPostingRules.cashAccountId,
        bankAccountId: accountingPostingRules.bankAccountId,
        incomeAccountId: accountingPostingRules.incomeAccountId,
        discountAccountId: accountingPostingRules.discountAccountId,
        fxRealizedAccountId: accountingPostingRules.fxRealizedAccountId,
        fxUnrealizedAccountId: accountingPostingRules.fxUnrealizedAccountId,
        fxRoundingAccountId: accountingPostingRules.fxRoundingAccountId,
        ctaAccountId: accountingPostingRules.ctaAccountId,
        updatedAt: accountingPostingRules.updatedAt,
      })
      .from(accountingPostingRules)
      .where(eq(accountingPostingRules.workspaceSubdomain, subdomain))
      .limit(1);
    const row = rows[0];
    if (!row) return {};
    return {
      arAccountId: row.arAccountId,
      cashAccountId: row.cashAccountId,
      bankAccountId: row.bankAccountId,
      incomeAccountId: row.incomeAccountId,
      discountAccountId: row.discountAccountId,
      fxRealizedAccountId: row.fxRealizedAccountId,
      fxUnrealizedAccountId: row.fxUnrealizedAccountId,
      fxRoundingAccountId: row.fxRoundingAccountId,
      ctaAccountId: row.ctaAccountId,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function savePostingRules(tenant: string, rules: PostingRules): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  // IAS 21 accounts are written only when sent, so a client that predates them
  // never clears accounts configured elsewhere.
  const fxAccounts = Object.fromEntries(
    (
      [
        "fxRealizedAccountId",
        "fxUnrealizedAccountId",
        "fxRoundingAccountId",
        "ctaAccountId",
      ] as const
    )
      .filter((field) => rules[field] !== undefined)
      .map((field) => [field, rules[field] ?? null]),
  );
  await withTenant(subdomain, async (tx) => {
    // Before-state read joins this transaction, so the diff and the write commit
    // (or roll back) together with the audit row below.
    const previous = await getPostingRules(tenant);
    await tx
      .insert(accountingPostingRules)
      .values({
        workspaceSubdomain: subdomain,
        arAccountId: rules.arAccountId ?? null,
        cashAccountId: rules.cashAccountId ?? null,
        bankAccountId: rules.bankAccountId ?? null,
        incomeAccountId: rules.incomeAccountId ?? null,
        discountAccountId: rules.discountAccountId ?? null,
        ...fxAccounts,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [accountingPostingRules.workspaceSubdomain],
        set: {
          arAccountId: rules.arAccountId ?? null,
          cashAccountId: rules.cashAccountId ?? null,
          bankAccountId: rules.bankAccountId ?? null,
          incomeAccountId: rules.incomeAccountId ?? null,
          discountAccountId: rules.discountAccountId ?? null,
          ...fxAccounts,
          updatedAt: new Date(),
        },
      });
    await auditPostingRulesSaved(tx, subdomain, previous, rules);
  });
}

export async function listOpeningBalances(
  tenant: string,
  fiscalYearId: string,
): Promise<OpeningBalance[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: accountingOpeningBalances.id,
        fiscalYearId: accountingOpeningBalances.fiscalYearId,
        accountId: accountingOpeningBalances.accountId,
        debit: accountingOpeningBalances.debit,
        credit: accountingOpeningBalances.credit,
      })
      .from(accountingOpeningBalances)
      .where(
        and(
          eq(accountingOpeningBalances.workspaceSubdomain, subdomain),
          eq(accountingOpeningBalances.fiscalYearId, fiscalYearId),
        ),
      );
    return rows.map((row) => ({
      id: row.id,
      fiscalYearId: row.fiscalYearId,
      accountId: row.accountId,
      debit: Number(row.debit),
      credit: Number(row.credit),
    }));
  });
}

export async function replaceOpeningBalances(
  tenant: string,
  fiscalYearId: string,
  balances: OpeningBalance[],
  reason?: string,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const previous = await listOpeningBalances(tenant, fiscalYearId);
    await tx
      .delete(accountingOpeningBalances)
      .where(
        and(
          eq(accountingOpeningBalances.workspaceSubdomain, subdomain),
          eq(accountingOpeningBalances.fiscalYearId, fiscalYearId),
        ),
      );
    if (balances.length === 0) {
      await auditOpeningBalancesReplaced(tx, subdomain, fiscalYearId, previous, [], reason);
      return;
    }
    const { functionalCurrency } = await ensureCurrencySettingsInTx(tx, subdomain);
    await tx.insert(accountingOpeningBalances).values(
      balances.map((row) => {
        const debit = String(row.debit ?? 0);
        const credit = String(row.credit ?? 0);
        return {
          id: row.id,
          workspaceSubdomain: subdomain,
          fiscalYearId,
          accountId: row.accountId,
          debit,
          credit,
          txnCurrency: functionalCurrency,
          txnDebit: debit,
          txnCredit: credit,
          exchangeRate: "1",
          rateType: "HISTORICAL",
          funcDebit: debit,
          funcCredit: credit,
        };
      }),
    );
    await auditOpeningBalancesReplaced(tx, subdomain, fiscalYearId, previous, balances, reason);
  });
}

/** Bank statements and reconciliation live in their own module (300-line ceiling). */
export {
  listBankStatements,
  matchBankReconciliation,
  saveBankStatement,
} from "./accountingBankingRepository.js";

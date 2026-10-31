import type { MemberTrialBalanceRow } from "@mms/shared";
import { withTenant } from "../../db/tenant-context.js";
import { aggregateAccountingReport } from "../../db/repositories/accountingRepositoryReport.js";
import { ensureCurrencySettingsInTx } from "../../db/repositories/accountingCurrencySettingsRepository.js";
import { getPostingRules } from "../../db/repositories/accountingLedgerOpsRepository.js";
import {
  deleteConsolidationGroup,
  listConsolidationGroups,
  saveConsolidationGroup,
} from "../../db/repositories/platformConsolidationRepository.js";
import { insertPlatformActivityLog } from "../../db/repositories/platformActivityLogsRepository.js";

export interface MemberLedger {
  functionalCurrency: string;
  balanceSheetRows: MemberTrialBalanceRow[];
  periodResultRows: MemberTrialBalanceRow[];
}

/**
 * One member's books, read inside that member's own RLS-scoped transaction —
 * consolidation never issues a cross-tenant query, it visits each workspace in turn.
 */
async function loadMemberLedger(
  member: string,
  dateFrom: string,
  dateTo: string,
): Promise<MemberLedger> {
  const subdomain = member.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const { functionalCurrency } = await ensureCurrencySettingsInTx(tx, subdomain);
    const postingRules = await getPostingRules(subdomain);
    const report = await aggregateAccountingReport(subdomain, { dateFrom, dateTo, postingRules });
    // Report balances are positive on each account's normal side; translation
    // works on debit-positive balances, so derive them from the raw totals.
    const toRow = (row: {
      code: string;
      name: string;
      type: string;
      totalDebit: number;
      totalCredit: number;
    }) => ({
      code: row.code,
      name: row.name,
      type: row.type,
      balance: Math.round((row.totalDebit - row.totalCredit) * 100) / 100,
    });
    return {
      functionalCurrency,
      balanceSheetRows: report.balanceSheetTrialBalance.map(toRow),
      periodResultRows: (report.incomeStatementTrialBalance ?? report.trialBalance).map(toRow),
    };
  });
}

/** Storage and member-ledger access for platform consolidation (ports & adapters seam). */
export const platformConsolidationRepository = {
  listConsolidationGroups,
  saveConsolidationGroup,
  deleteConsolidationGroup,
  loadMemberLedger,
  insertPlatformActivityLog,
};

export type PlatformConsolidationRepository = typeof platformConsolidationRepository;

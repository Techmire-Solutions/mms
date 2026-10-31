import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BankReconciliationMatch,
  BankStatement,
  BankStatementInsert,
  FiscalYear,
  OpeningBalance,
  OpeningBalanceInsert,
  PostingRules,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { invalidateAccountingQueries } from "@/tenant/features/accounting/hooks/invalidateAccountingQueries";
import { assertContractOk } from "@/lib/apiContractError";

const RULES_KEY = ["accounting", "posting-rules"] as const;
export { RULES_KEY as ACCOUNTING_POSTING_RULES_QUERY_KEY };
const OPENING_KEY = ["accounting", "opening-balances"] as const;
const BANK_KEY = ["accounting", "bank-statements"] as const;

export {
  hasAtMostTwoDecimals,
  parseMoneyInput,
  type MoneySeparator,
} from "@/tenant/features/accounting/hooks/accountingMoneyParsers";

export function useAccountingPostingRules(enabled = true) {
  return useQuery({
    queryKey: RULES_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.accountingLedger.getPostingRules({
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to load posting rules");
      return (response.body as { rules: PostingRules }).rules;
    },
    enabled,
  });
}

export function useSaveAccountingPostingRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rules: PostingRules) => {
      const response = await apiContract.accountingLedger.putPostingRules({ body: rules });
      assertContractOk(response, "Failed to save posting rules");
      return response.body as { rules: PostingRules };
    },
    /**
     * The server resolves cash/receivables classification from these rules, and
     * `report-aggregates` holds a 5-minute `staleTime` — invalidating only
     * `RULES_KEY` left the Trial Balance and Income Statement classifying
     * figures with the previous rules.
     */
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RULES_KEY });
      invalidateAccountingQueries(queryClient);
    },
  });
}

export interface CloseFiscalYearInput {
  id: string;
  /**
   * Retained-earnings account for the closing entry. The server falls back to
   * the stored preference and rejects the close with a 422 when neither is set,
   * so callers must send it explicitly whenever the preference is empty.
   */
  retainedEarningsAccountId?: string;
}

/**
 * Closing a fiscal year posts the closing entry, flips the year's status and
 * changes every revenue/expense/equity figure. Nothing here used to invalidate,
 * so the ledger, the fiscal-year list and the reports all stayed stale until a
 * manual refresh.
 */
export function useCloseFiscalYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, retainedEarningsAccountId }: CloseFiscalYearInput) => {
      const response = await apiContract.accountingLedger.closeFiscalYear({
        params: { id },
        body: retainedEarningsAccountId ? { retainedEarningsAccountId } : {},
      });
      assertContractOk(response, "Failed to close fiscal year");
      return response.body as { fiscalYear: FiscalYear };
    },
    onSuccess: () => invalidateAccountingQueries(queryClient),
  });
}

/**
 * Opening balances for one year.
 *
 * `keepPreviousData` is load-bearing: the Setup panel PUTs a *full replace* of
 * the year's rows, so a bare year switch that left `data` undefined made the
 * first Add write `[newRow]` — deleting every stored balance for that year while
 * reporting success. Keeping the previous data (plus an `isPlaceholderData`
 * gate in the panel) anchors the replace to rows that really exist.
 */
export function useOpeningBalances(fiscalYearId: string | undefined) {
  return useQuery({
    queryKey: [...OPENING_KEY, fiscalYearId],
    queryFn: async ({ signal }) => {
      const response = await apiContract.accountingLedger.listOpeningBalances({
        query: { fiscalYearId: fiscalYearId ?? "" },
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to load opening balances");
      return (response.body as { balances: OpeningBalance[] }).balances;
    },
    enabled: Boolean(fiscalYearId),
    placeholderData: keepPreviousData,
  });
}

export interface SaveOpeningBalancesInput {
  fiscalYearId: string;
  balances: OpeningBalanceInsert[];
}

export function useSaveOpeningBalances() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SaveOpeningBalancesInput) => {
      const response = await apiContract.accountingLedger.putOpeningBalances({ body: payload });
      assertContractOk(response, "Failed to save opening balances");
      return response.body as { balances: OpeningBalance[] };
    },
    onSuccess: (saved, payload) => {
      // The response is the authoritative replacement set; seeding it directly
      // closes the window where a second Add would replay a stale list over the
      // rows the server just stored.
      queryClient.setQueryData([...OPENING_KEY, payload.fiscalYearId], saved.balances);
      void queryClient.invalidateQueries({ queryKey: OPENING_KEY });
    },
  });
}

/**
 * Posting opening balances creates a journal entry, so the ledger keys must refresh too.
 *
 * `posted: false` means the balances were already posted unchanged — an
 * idempotent replay, not a new posting.
 */
export function usePostOpeningBalances() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fiscalYearId: string) => {
      const response = await apiContract.accountingLedger.postOpeningBalances({
        params: { fiscalYearId },
        body: {},
      });
      assertContractOk(response, "Failed to post opening balances");
      return response.body as { success: boolean; posted: boolean };
    },
    onSuccess: () => invalidateAccountingQueries(queryClient),
  });
}

export function useBankStatements(enabled = true) {
  return useQuery({
    queryKey: BANK_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.accountingLedger.listBankStatements({
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to load bank statements");
      return (response.body as { statements: BankStatement[] }).statements;
    },
    enabled,
  });
}

export function useSaveBankStatement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (statement: BankStatementInsert) => {
      const response = await apiContract.accountingLedger.putBankStatement({ body: statement });
      assertContractOk(response, "Failed to save bank statement");
      return response.body as { statement: BankStatement };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BANK_KEY }),
  });
}

export function useMatchBankReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (match: BankReconciliationMatch) => {
      const response = await apiContract.accountingLedger.matchBankReconciliation({ body: match });
      assertContractOk(response, "Failed to save bank reconciliation");
      return response.body as { success: boolean };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BANK_KEY }),
  });
}

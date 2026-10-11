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
import { apiJson } from "@/lib/apiClient";
import { invalidateAccountingQueries } from "@/tenant/features/accounting/hooks/invalidateAccountingQueries";

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
      const body = await apiJson<{ rules: PostingRules }>("/api/accounting/posting-rules", {
        signal,
      });
      return body.rules;
    },
    enabled,
  });
}

export function useSaveAccountingPostingRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rules: PostingRules) =>
      apiJson<{ rules: PostingRules }>("/api/accounting/posting-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      }),
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
    mutationFn: ({ id, retainedEarningsAccountId }: CloseFiscalYearInput) =>
      apiJson<{ fiscalYear: FiscalYear }>(`/api/accounting/fiscal-years/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retainedEarningsAccountId ? { retainedEarningsAccountId } : {}),
      }),
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
      const body = await apiJson<{ balances: OpeningBalance[] }>(
        `/api/accounting/opening-balances?fiscalYearId=${encodeURIComponent(fiscalYearId ?? "")}`,
        { signal },
      );
      return body.balances;
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
    mutationFn: (payload: SaveOpeningBalancesInput) =>
      apiJson<{ balances: OpeningBalance[] }>("/api/accounting/opening-balances", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
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
    mutationFn: (fiscalYearId: string) =>
      apiJson<{ success: boolean; posted: boolean }>(
        `/api/accounting/opening-balances/${fiscalYearId}/post`,
        {
          method: "POST",
        },
      ),
    onSuccess: () => invalidateAccountingQueries(queryClient),
  });
}

export function useBankStatements(enabled = true) {
  return useQuery({
    queryKey: BANK_KEY,
    queryFn: async ({ signal }) => {
      const body = await apiJson<{ statements: BankStatement[] }>(
        "/api/accounting/bank-statements",
        { signal },
      );
      return body.statements;
    },
    enabled,
  });
}

export function useSaveBankStatement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (statement: BankStatementInsert) =>
      apiJson<{ statement: BankStatement }>("/api/accounting/bank-statements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statement),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BANK_KEY }),
  });
}

export function useMatchBankReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (match: BankReconciliationMatch) =>
      apiJson<{ success: boolean }>("/api/accounting/bank-reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(match),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BANK_KEY }),
  });
}

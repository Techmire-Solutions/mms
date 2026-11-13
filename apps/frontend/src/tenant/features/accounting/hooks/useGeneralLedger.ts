import { useState } from "react";
import type { Account, AccountType } from "@/lib/data/accountingData";
import { useAccountingLedger } from "./useAccountingQueries";

export interface GeneralLedgerLineWithRunning {
  date: string;
  ref: string;
  description: string;
  lineDesc?: string;
  debit: number;
  credit: number;
  running: number;
}

/** Rows per ledger page; the server computes the exact running balance. */
export const LEDGER_PAGE_SIZE = 100;

/**
 * General Ledger state, backed by the server aggregate.
 *
 * The old browser aggregate silently stopped at 5,000 entries and still showed a
 * balanced-looking closing figure; the server returns
 * the opening balance, the page's running balances and the whole-window totals, so
 * paging can never understate the account's position.
 */
export function useGeneralLedger(accounts: Account[]) {
  const [selectedAccount, setSelectedAccountState] = useState("");
  const [typeFilter, setTypeFilter] = useState<AccountType | "all">("all");
  const [dateFrom, setDateFromState] = useState("");
  const [dateTo, setDateToState] = useState("");
  const [page, setPage] = useState(1);

  const filteredAccounts = accounts
    .filter((account) => account.isActive !== false)
    .filter((account) => typeFilter === "all" || account.type === typeFilter)
    .sort((firstAccount, secondAccount) => firstAccount.code.localeCompare(secondAccount.code));

  const activeAccount = accounts.find((account) => account.id === selectedAccount);
  const report = useAccountingLedger(
    {
      accountId: selectedAccount,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      limit: LEDGER_PAGE_SIZE,
    },
    { enabled: Boolean(selectedAccount) },
  );
  const pageData = report.data;

  const linesWithRunning: GeneralLedgerLineWithRunning[] = (pageData?.lines ?? []).map((line) => ({
    date: line.date,
    ref: line.ref,
    description: line.description,
    lineDesc: line.lineDescription,
    debit: line.debit,
    credit: line.credit,
    running: line.running,
  }));

  /** Any filter change invalidates the page position. */
  const resetPage = () => setPage(1);

  return {
    selectedAccount,
    setSelectedAccount: (value: string) => {
      setSelectedAccountState(value);
      resetPage();
    },
    typeFilter,
    setTypeFilter,
    dateFrom,
    setDateFrom: (value: string) => {
      setDateFromState(value);
      resetPage();
    },
    dateTo,
    setDateTo: (value: string) => {
      setDateToState(value);
      resetPage();
    },
    filteredAccounts,
    activeAccount,
    lines: linesWithRunning,
    linesWithRunning,
    openingBalance: pageData?.openingBalance ?? 0,
    totalDebit: pageData?.totalDebit ?? 0,
    totalCredit: pageData?.totalCredit ?? 0,
    /** Closing balance for the whole window, not just this page. */
    balance: pageData?.closingBalance ?? 0,
    page,
    setPage,
    pageSize: LEDGER_PAGE_SIZE,
    total: pageData?.total ?? 0,
    hasMore: pageData?.hasMore ?? false,
    isLoading: report.isLoading,
    isError: report.isError,
  };
}

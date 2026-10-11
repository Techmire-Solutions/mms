import { useState } from "react";
import { moneyToCents } from "@mms/shared";
import {
  computeLedger,
  type Account,
  type JournalEntry,
  type AccountType,
} from "@/lib/data/accountingData";

export interface GeneralLedgerLineWithRunning {
  date: string;
  ref: string;
  description: string;
  lineDesc?: string;
  debit: number;
  credit: number;
  running: number;
}

export function useGeneralLedger(accounts: Account[], entries: JournalEntry[]) {
  const [selectedAccount, setSelectedAccount] = useState("");
  const [typeFilter, setTypeFilter] = useState<AccountType | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredAccounts = accounts
    .filter((account) => account.isActive !== false)
    .filter((account) => typeFilter === "all" || account.type === typeFilter)
    .sort((firstAccount, secondAccount) => firstAccount.code.localeCompare(secondAccount.code));

  const activeAccount = accounts.find((account) => account.id === selectedAccount);
  const lines = (() =>
    selectedAccount
      ? computeLedger(selectedAccount, entries, dateFrom || undefined, dateTo || undefined)
      : [])();

  /**
   * The running balance accumulates in integer cents and converts once, so a
   * long ledger cannot drift and the exported column is valid money — a float
   * accumulator turned 0.10 + 0.20 into 0.30000000000000004.
   */
  let totalDebitCents = 0;
  let totalCreditCents = 0;
  let runningCents = 0;
  const linesWithRunning: GeneralLedgerLineWithRunning[] = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    const ledgerLine = lines[i];
    const debitCents = moneyToCents(ledgerLine.debit);
    const creditCents = moneyToCents(ledgerLine.credit);
    totalDebitCents += debitCents;
    totalCreditCents += creditCents;
    runningCents += debitCents - creditCents;
    linesWithRunning[i] = {
      ...ledgerLine,
      debit: debitCents / 100,
      credit: creditCents / 100,
      running: runningCents / 100,
    };
  }
  const balance = (totalDebitCents - totalCreditCents) / 100;

  return {
    selectedAccount,
    setSelectedAccount,
    typeFilter,
    setTypeFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    filteredAccounts,
    activeAccount,
    lines,
    linesWithRunning,
    totalDebit: totalDebitCents / 100,
    totalCredit: totalCreditCents / 100,
    balance,
  };
}

import { moneyToCents, type Account, type JournalEntry } from "@mms/shared";
import { centsToMoney } from "./accountingData";

export function computeLedger(
  accountId: string,
  entries: JournalEntry[],
  dateFrom?: string,
  dateTo?: string,
): {
  id: string;
  date: string;
  ref: string;
  description: string;
  lineDesc?: string;
  debit: number;
  credit: number;
}[] {
  const result: {
    id: string;
    date: string;
    ref: string;
    description: string;
    lineDesc?: string;
    debit: number;
    credit: number;
  }[] = [];
  const postedEntries = entries.filter((e) => e.status === "posted");
  postedEntries.forEach((entry) => {
    if (dateFrom && entry.date < dateFrom) return;
    if (dateTo && entry.date > dateTo) return;
    entry.lines.forEach((line) => {
      if (line.account_id === accountId) {
        result.push({
          id: line.id,
          date: entry.date,
          ref: entry.ref,
          description: entry.description,
          lineDesc: line.description,
          debit: centsToMoney(moneyToCents(line.debit)),
          credit: centsToMoney(moneyToCents(line.credit)),
        });
      }
    });
  });
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export function computeTrialBalance(
  accounts: Account[],
  entries: JournalEntry[],
  dateFrom?: string,
  dateTo?: string,
): {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}[] {
  const result = accounts.map((acc) => {
    let debitCents = 0;
    let creditCents = 0;
    const posted = entries.filter((e) => e.status === "posted");
    posted.forEach((entry) => {
      if (dateFrom && entry.date < dateFrom) return;
      if (dateTo && entry.date > dateTo) return;
      entry.lines.forEach((line) => {
        if (line.account_id === acc.id) {
          debitCents += moneyToCents(line.debit);
          creditCents += moneyToCents(line.credit);
        }
      });
    });
    const netCents = debitCents - creditCents;
    const balanceCents = acc.type === "Asset" || acc.type === "Expense" ? netCents : -netCents;
    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype,
      totalDebit: centsToMoney(debitCents),
      totalCredit: centsToMoney(creditCents),
      balance: centsToMoney(balanceCents),
    };
  });
  return result.sort((a, b) => a.code.localeCompare(b.code));
}

export function computeFinancials(
  accounts: Account[],
  entries: JournalEntry[],
  dateFrom?: string,
  dateTo?: string,
) {
  const tb = computeTrialBalance(accounts, entries, dateFrom, dateTo);
  let assetCents = 0,
    liabilityCents = 0,
    equityCents = 0,
    revenueCents = 0,
    expenseCents = 0;
  tb.forEach((r) => {
    const netCents = moneyToCents(r.totalDebit) - moneyToCents(r.totalCredit);
    if (r.type === "Asset") assetCents += netCents;
    else if (r.type === "Liability") liabilityCents -= netCents;
    else if (r.type === "Equity") equityCents -= netCents;
    else if (r.type === "Revenue") revenueCents -= netCents;
    else if (r.type === "Expense") expenseCents += netCents;
  });
  const assets = centsToMoney(assetCents);
  const liabilities = centsToMoney(liabilityCents);
  const equity = centsToMoney(equityCents);
  const revenue = centsToMoney(revenueCents);
  const expenses = centsToMoney(expenseCents);
  const netSurplus = centsToMoney(revenueCents - expenseCents);
  const netCashFlow = centsToMoney(assetCents - liabilityCents);

  let cashInflowCents = 0;
  let cashOutflowCents = 0;
  const cashAccounts = accounts.filter(
    (a) =>
      a.type === "Asset" &&
      (a.code.startsWith("10") ||
        a.name.toLowerCase().includes("cash") ||
        a.name.toLowerCase().includes("bank")),
  );
  const cashAccountIds = new Set(cashAccounts.map((a) => a.id));
  const posted = entries.filter((e) => e.status === "posted");
  posted.forEach((entry) => {
    if (dateFrom && entry.date < dateFrom) return;
    if (dateTo && entry.date > dateTo) return;
    entry.lines.forEach((line) => {
      if (cashAccountIds.has(line.account_id)) {
        cashInflowCents += moneyToCents(line.debit);
        cashOutflowCents += moneyToCents(line.credit);
      }
    });
  });

  return {
    revenue,
    expenses,
    netSurplus,
    assets,
    liabilities,
    equity,
    netCashFlow,
    cashInflow: centsToMoney(cashInflowCents),
    cashOutflow: centsToMoney(cashOutflowCents),
    tb,
  };
}

import { isJournalEntryBalanced, moneyToCents } from "./accountingLedgerInvariants.js";
import type { JournalLine } from "./accountingModuleManifest.js";

/** Swap debit/credit for a reversing entry (cancel / void). */
export function buildReversalLines(lines: readonly JournalLine[]): JournalLine[] {
  return lines.map((row, index) => ({
    ...row,
    id: `rev-${row.id || index}`,
    debit: row.credit,
    credit: row.debit,
    ...(row.txn_currency !== undefined
      ? { txn_debit: row.txn_credit, txn_credit: row.txn_debit }
      : {}),
    description: row.description ? `Reversal: ${row.description}` : "Reversal",
  }));
}

/** Dr Income / Cr AR for a credit note. */
export function buildCreditNotePostingLines(input: {
  creditNoteId: string;
  amount: number;
  description: string;
  accounts: LedgerPostingAccounts;
}): JournalLine[] | null {
  if (!hasInvoicePostingAccounts(input.accounts) || input.amount <= 0) return null;
  return [
    line("cn-inc", input.accounts.incomeAccountId as string, input.amount, 0, input.description),
    line("cn-ar", input.accounts.arAccountId as string, 0, input.amount, input.description),
  ];
}

/** Dr AR / Cr Income for an applied late fee. */
export function buildLateFeePostingLines(input: {
  invoiceId: string;
  amount: number;
  description: string;
  accounts: LedgerPostingAccounts;
}): JournalLine[] | null {
  if (!hasInvoicePostingAccounts(input.accounts) || input.amount <= 0) return null;
  return [
    line("lf-ar", input.accounts.arAccountId as string, input.amount, 0, input.description),
    line("lf-inc", input.accounts.incomeAccountId as string, 0, input.amount, input.description),
  ];
}

export interface LedgerPostingAccounts {
  arAccountId?: string | null;
  cashAccountId?: string | null;
  incomeAccountId?: string | null;
  discountAccountId?: string | null;
  fxRealizedAccountId?: string | null;
  fxRoundingAccountId?: string | null;
}

export interface InvoicePostingInput {
  invoiceId: string;
  description: string;
  date: string;
  finalAmt: number;
  discountAmt?: number;
  accounts: LedgerPostingAccounts;
}

export interface PaymentPostingInput {
  paymentId: string;
  description: string;
  date: string;
  amount: number;
  accounts: LedgerPostingAccounts;
}

export interface ClosingAccountBalance {
  accountId: string;
  type: "Revenue" | "Expense";
  net: number;
}

export interface OpeningBalanceLine {
  accountId: string;
  debit: number;
  credit: number;
}

function line(
  id: string,
  accountId: string,
  debit: number,
  credit: number,
  description: string,
): JournalLine {
  return { id, account_id: accountId, debit, credit, description };
}

export function hasInvoicePostingAccounts(accounts: LedgerPostingAccounts): boolean {
  return Boolean(accounts.arAccountId && accounts.incomeAccountId);
}

export function hasPaymentPostingAccounts(accounts: LedgerPostingAccounts): boolean {
  return Boolean(accounts.cashAccountId && accounts.arAccountId);
}

/** Dr AR / Cr Income, optional Dr Discount when a discount account is configured. */
export function buildInvoicePostingLines(input: InvoicePostingInput): JournalLine[] | null {
  const { accounts, finalAmt, discountAmt = 0, description } = input;
  if (!hasInvoicePostingAccounts(accounts) || finalAmt <= 0) return null;
  const arId = accounts.arAccountId as string;
  const incomeId = accounts.incomeAccountId as string;
  const discountCents = moneyToCents(discountAmt);
  const finalCents = moneyToCents(finalAmt);
  if (discountCents > 0 && accounts.discountAccountId) {
    const incomeCents = finalCents + discountCents;
    return [
      line("il-ar", arId, finalCents / 100, 0, description),
      line("il-disc", accounts.discountAccountId, discountCents / 100, 0, description),
      line("il-inc", incomeId, 0, incomeCents / 100, description),
    ];
  }
  return [
    line("il-ar", arId, finalAmt, 0, description),
    line("il-inc", incomeId, 0, finalAmt, description),
  ];
}

/** Dr Cash / Cr AR. */
export function buildPaymentPostingLines(input: PaymentPostingInput): JournalLine[] | null {
  const { accounts, amount, description } = input;
  if (!hasPaymentPostingAccounts(accounts) || amount <= 0) return null;
  return [
    line("pl-cash", accounts.cashAccountId as string, amount, 0, description),
    line("pl-ar", accounts.arAccountId as string, 0, amount, description),
  ];
}

/**
 * Close P&L into retained earnings by zeroing every revenue/expense account
 * (contra balances flip the debit/credit side), then plug the net difference to
 * retained earnings. Returns null only when there is no P&L activity or the
 * retained-earnings account is missing.
 */
export function buildClosingEntryLines(
  retainedEarningsAccountId: string,
  balances: readonly ClosingAccountBalance[],
): JournalLine[] | null {
  if (!retainedEarningsAccountId) return null;
  const lines: JournalLine[] = [];
  let debitCents = 0;
  let creditCents = 0;
  for (const row of balances) {
    const netCents = moneyToCents(row.net);
    if (netCents === 0) continue;
    const amount = Math.abs(netCents) / 100;
    // Revenue credit balances are debited; expense debit balances are credited.
    // A negative net is a contra balance and takes the opposite side.
    const isDebit = row.type === "Revenue" ? netCents > 0 : netCents < 0;
    const prefix = row.type === "Revenue" ? "cl-rev" : "cl-exp";
    const label = row.type === "Revenue" ? "Close revenue" : "Close expense";
    lines.push(
      isDebit
        ? line(`${prefix}-${row.accountId}`, row.accountId, amount, 0, label)
        : line(`${prefix}-${row.accountId}`, row.accountId, 0, amount, label),
    );
    if (isDebit) debitCents += Math.abs(netCents);
    else creditCents += Math.abs(netCents);
  }
  const plugCents = debitCents - creditCents;
  if (plugCents > 0) {
    lines.push(line("cl-re", retainedEarningsAccountId, 0, plugCents / 100, "Retained earnings"));
  } else if (plugCents < 0) {
    lines.push(
      line("cl-re", retainedEarningsAccountId, Math.abs(plugCents) / 100, 0, "Retained earnings"),
    );
  }
  return isJournalEntryBalanced(lines) ? lines : null;
}

export function buildOpeningEntryLines(
  balances: readonly OpeningBalanceLine[],
): JournalLine[] | null {
  const lines = balances
    .filter((row) => moneyToCents(row.debit) > 0 || moneyToCents(row.credit) > 0)
    .map((row, index) =>
      line(`ob-${index}`, row.accountId, row.debit, row.credit, "Opening balance"),
    );
  return isJournalEntryBalanced(lines) ? lines : null;
}

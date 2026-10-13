import { moneyToCents } from "@mms/shared";
import type { Account, JournalEntry } from "@/lib/data/accountingData";
import {
  isCashInstrumentAccount,
  resolveVoucherPrintKind,
  voucherPrintLayout,
  type VoucherPrintKind,
  type VoucherPrintLayout,
} from "@/tenant/features/accounting/components/paymentVoucherKind";

export interface SalaryVoucherRef {
  staffId: string;
  payPeriod: string;
}

export interface PaymentVoucherLine {
  account: string;
  amount: number;
}

export interface VoucherJournalLine {
  account: string;
  debit: number;
  credit: number;
}

export interface PaymentVoucherModel {
  kind: VoucherPrintKind;
  layout: VoucherPrintLayout;
  amount: number;
  /** Money-out: accounts debited. Receipts: accounts credited. */
  particulars: PaymentVoucherLine[];
  /** Money-out: cash or bank the money left from. Receipts: where cash arrived. */
  paidFrom: string[];
  /** Non-cash credits on a payment, such as a salary late deduction. */
  deductions: PaymentVoucherLine[];
  /** Cash or bank actually paid. Matches `amount` when nothing was deducted. */
  netAmount: number;
  journalLines: VoucherJournalLine[];
  salary: SalaryVoucherRef | null;
}

/** `processSalaryEntry` writes `Salary payment — staff <id> (<YYYY-MM>)` on every line, even when a note overrides the narration. */
const SALARY_LINE_PATTERN = /staff (.+) \((\d{4}-\d{2})\)$/;
/** Fallback: the original `SAL-<YYYY-MM>-<staffId>` reference. */
const SALARY_REF_PATTERN = /^SAL-(\d{4}-\d{2})-(.+)$/;

export function parseSalaryVoucherRef(
  entry: Pick<JournalEntry, "transaction_type" | "lines" | "ref">,
): SalaryVoucherRef | null {
  if (entry.transaction_type !== "salary") return null;
  for (const line of entry.lines) {
    const match = SALARY_LINE_PATTERN.exec(line.description);
    if (match?.[1] && match[2]) return { staffId: match[1], payPeriod: match[2] };
  }
  const refMatch = SALARY_REF_PATTERN.exec(entry.ref);
  return refMatch?.[1] && refMatch[2] ? { staffId: refMatch[2], payPeriod: refMatch[1] } : null;
}

function accountLabel(accountsById: Map<string, Account>, accountId: string): string {
  const account = accountsById.get(accountId);
  return account ? `${account.code} — ${account.name}` : accountId;
}

export function buildPaymentVoucherModel(
  entry: JournalEntry,
  accounts: readonly Account[],
): PaymentVoucherModel {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const kind = resolveVoucherPrintKind(entry, accounts) ?? "journal";
  const layout = voucherPrintLayout(kind);
  const debitLines = entry.lines.filter((line) => line.debit > 0);
  const creditLines = entry.lines.filter((line) => line.credit > 0);
  const detailLines = layout === "receipt" ? creditLines : debitLines;
  const deductionLines =
    layout === "payment"
      ? creditLines.filter((line) => !isCashInstrumentAccount(accountsById.get(line.account_id)))
      : [];
  const cashCredits = creditLines.filter((line) =>
    isCashInstrumentAccount(accountsById.get(line.account_id)),
  );
  const sourceLines =
    layout === "receipt" ? debitLines : deductionLines.length > 0 ? cashCredits : creditLines;
  const amountCents = debitLines.reduce((sum, line) => sum + moneyToCents(line.debit), 0);
  const netCents =
    deductionLines.length > 0
      ? cashCredits.reduce((sum, line) => sum + moneyToCents(line.credit), 0)
      : amountCents;
  return {
    kind,
    layout,
    amount: amountCents / 100,
    particulars: detailLines.map((line) => ({
      account: accountLabel(accountsById, line.account_id),
      amount: layout === "receipt" ? line.credit : line.debit,
    })),
    deductions: deductionLines.map((line) => ({
      account: accountLabel(accountsById, line.account_id),
      amount: line.credit,
    })),
    netAmount: netCents / 100,
    paidFrom: [...new Set(sourceLines.map((line) => accountLabel(accountsById, line.account_id)))],
    journalLines: entry.lines.map((line) => ({
      account: accountLabel(accountsById, line.account_id),
      debit: line.debit,
      credit: line.credit,
    })),
    salary: parseSalaryVoucherRef(entry),
  };
}

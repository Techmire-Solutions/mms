import type { AppTranslationKey } from "@mms/shared";
import type { Account, JournalEntry } from "@/lib/data/accountingData";
import { isCashAccount } from "@/tenant/features/accounting/components/cashbookViewShared";

/** Printed voucher family. Payment is the existing expense / salary voucher. */
export type VoucherPrintKind =
  | "payment"
  | "cash_payment"
  | "bank_payment"
  | "petty_cash"
  | "cash_receipt"
  | "bank_receipt"
  | "journal";

export type VoucherPrintLayout = "payment" | "receipt" | "journal";

type CashInstrument = "petty" | "bank" | "cash";

export const VOUCHER_KIND_TITLE_KEY: Record<VoucherPrintKind, AppTranslationKey> = {
  payment: "accounting.journal.voucher.title",
  cash_payment: "accounting.journal.voucher.kind.cashPayment",
  bank_payment: "accounting.journal.voucher.kind.bankPayment",
  petty_cash: "accounting.journal.voucher.kind.pettyCash",
  cash_receipt: "accounting.journal.voucher.kind.cashReceipt",
  bank_receipt: "accounting.journal.voucher.kind.bankReceipt",
  journal: "accounting.journal.voucher.kind.journal",
};

export function voucherPrintLayout(kind: VoucherPrintKind): VoucherPrintLayout {
  if (kind === "cash_receipt" || kind === "bank_receipt") return "receipt";
  if (kind === "journal") return "journal";
  return "payment";
}

/** Name recorded on the voucher. Blank or system stamps fall back to whoever is signed in. */
export function voucherPreparerName(recorded: string | undefined, currentUserName: string): string {
  const name = recorded?.trim() ?? "";
  if (name && name.toLowerCase() !== "system") return name;
  return currentUserName.trim();
}

export function isCashInstrumentAccount(account: Account | undefined): boolean {
  return cashInstrument(account) !== null;
}

function cashInstrument(account: Account | undefined): CashInstrument | null {
  if (!account || !isCashAccount(account)) return null;
  const name = account.name.toLowerCase();
  if (name.includes("petty") || account.code === "10200") return "petty";
  if (name.includes("bank") || account.code === "10300") return "bank";
  return "cash";
}

/**
 * Posted, live vouchers. Cash instrument decides CP / petty cash / bank payment
 * and receipts; expense and salary stay on the payment voucher; everything else
 * is a journal voucher.
 */
export function resolveVoucherPrintKind(
  entry: JournalEntry,
  accounts: readonly Account[],
): VoucherPrintKind | null {
  if (entry.status !== "posted" || entry.deletedAt || entry.lines.length === 0) return null;
  if (entry.transaction_type === "salary") return "payment";

  const byId = new Map(accounts.map((account) => [account.id, account]));
  const instrument = (accountId: string) => cashInstrument(byId.get(accountId));
  const credits = entry.lines
    .filter((line) => line.credit > 0)
    .map((line) => instrument(line.account_id));
  const debits = entry.lines
    .filter((line) => line.debit > 0)
    .map((line) => instrument(line.account_id));
  const creditsPetty = credits.includes("petty");
  const creditsCash = credits.includes("cash");
  const creditsBank = credits.includes("bank");
  const debitsCash = debits.includes("cash");
  const debitsBank = debits.includes("bank");
  const debitsNonCash = entry.lines.some(
    (line) => line.debit > 0 && instrument(line.account_id) === null,
  );
  const creditsNonCash = entry.lines.some(
    (line) => line.credit > 0 && instrument(line.account_id) === null,
  );

  if (creditsPetty && debitsNonCash) return "petty_cash";
  if (creditsCash && !creditsBank && !creditsPetty && debitsNonCash) return "cash_payment";
  if (creditsBank && !creditsCash && !creditsPetty && debitsNonCash) return "bank_payment";

  const expenseIds = new Set(
    accounts.filter((account) => account.type === "Expense").map((account) => account.id),
  );
  if (entry.lines.some((line) => line.debit > 0 && expenseIds.has(line.account_id)))
    return "payment";
  if ((creditsCash || creditsBank || creditsPetty) && debitsNonCash) return "payment";

  if (debitsCash && !debitsBank && creditsNonCash) return "cash_receipt";
  if (debitsBank && !debitsCash && creditsNonCash) return "bank_receipt";
  return "journal";
}

export function isVoucherPrintable(entry: JournalEntry, accounts: readonly Account[]): boolean {
  return resolveVoucherPrintKind(entry, accounts) !== null;
}

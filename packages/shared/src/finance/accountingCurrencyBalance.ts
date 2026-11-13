/**
 * IAS 21 transaction-currency balance checks.
 *
 * Split out of `accountingLedgerInvariants.ts` to keep that module inside the
 * 300-line ceiling; the barrel re-exports both.
 */
import { moneyFromMinor, moneyToDecimalString, parseMoney } from "../money/money.js";

/** The IAS 21 transaction-amount columns of a journal line. */
export interface JournalLineTxnAmounts {
  txn_currency?: string | null;
  txn_debit?: string | null;
  txn_credit?: string | null;
}

/** One currency whose transaction-currency legs do not balance. */
export interface JournalCurrencyImbalance {
  currency: string;
  debit: string;
  credit: string;
  difference: string;
}

/**
 * Transaction-currency imbalances of a **single-currency** voucher (IAS 21).
 *
 * `isJournalEntryBalanced` proves the functional ledger balances. A voucher whose
 * lines are all in one foreign currency has a second, checkable condition: the
 * document-currency legs must balance too, or the document itself is wrong (a USD
 * journal whose debit and credit legs differ by $10, FX-converted at per-line rates
 * that happen to net out in PKR).
 *
 * Mixed-currency entries are deliberately **excluded**: a settlement posting retires
 * a USD receivable against PKR cash and books the realised gain in the functional
 * currency, so its lines are in different currencies on purpose and a per-currency
 * balance does not apply. Rows with a missing `txn_*` leg are excluded too — they
 * predate the IAS 21 backfill.
 */
export function journalCurrencyImbalances(
  lines: readonly JournalLineTxnAmounts[],
): JournalCurrencyImbalance[] {
  const withTxn = lines.filter((line) => (line.txn_currency?.trim() ?? "") !== "");
  if (withTxn.length < 2) return [];
  if (withTxn.some((line) => !line.txn_debit?.trim() || !line.txn_credit?.trim())) return [];
  const currencies = new Set(
    withTxn.map((line) => (line.txn_currency as string).trim().toUpperCase()),
  );
  if (currencies.size !== 1) return [];
  const currency = [...currencies][0]!;

  let debit = 0n;
  let credit = 0n;
  try {
    for (const line of withTxn) {
      debit += parseMoney(line.txn_debit as string, currency).minor;
      credit += parseMoney(line.txn_credit as string, currency).minor;
    }
  } catch {
    return [];
  }
  if (debit === credit) return [];
  return [
    {
      currency,
      debit: moneyToDecimalString(moneyFromMinor(debit, currency)),
      credit: moneyToDecimalString(moneyFromMinor(credit, currency)),
      difference: moneyToDecimalString(moneyFromMinor(debit - credit, currency)),
    },
  ];
}

/** One-line description for a 422 / trigger message. */
export function formatJournalCurrencyImbalance(imbalance: JournalCurrencyImbalance): string {
  return `${imbalance.currency} legs debit ${imbalance.debit} vs credit ${imbalance.credit} (difference ${imbalance.difference})`;
}

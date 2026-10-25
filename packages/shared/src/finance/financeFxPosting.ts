/**
 * IAS 21 posting for finance documents: invoice-style journals booked at the
 * document's rate, and payments that release receivables at the booked rate
 * while cash is recognised at the settlement rate (IAS 21.28 realized FX).
 */
import { convertMoney, invertExchangeRate } from "../money/fxConvert.js";
import { currencyMinorUnits } from "../money/iso4217.js";
import { moneyToDecimalString, parseMoney, subtractMoney, type Money } from "../money/money.js";
import { resolveJournalFxLines } from "./accountingFxLines.js";
import type { JournalLine } from "./accountingModuleManifest.js";
import {
  hasPaymentPostingAccounts,
  type LedgerPostingAccounts,
} from "./accountingLedgerPosting.js";

export interface DocumentFxContext {
  /** Document (transaction) currency. */
  currency: string;
  functionalCurrency: string;
  /** Functional units per one document unit. */
  rate: string;
  entryDate: string;
  roundingAccountId?: string | null;
}

const toDocumentMoney = (amount: number, currency: string): Money =>
  parseMoney(amount.toFixed(currencyMinorUnits(currency)), currency);

const toDecimal = (amount: number, currency: string): string =>
  moneyToDecimalString(toDocumentMoney(amount, currency));

/**
 * Re-express journal lines built in the document currency (their `debit` /
 * `credit` are document amounts) as IAS 21 dual-amount lines at `ctx.rate`.
 * Functional-currency documents pass through unchanged.
 */
export function stampDocumentFxLines(
  lines: readonly JournalLine[],
  ctx: DocumentFxContext,
): JournalLine[] {
  if (ctx.currency === ctx.functionalCurrency) return [...lines];
  return resolveJournalFxLines(
    lines.map((line) => ({
      ...line,
      txn_currency: ctx.currency,
      txn_debit: toDecimal(line.debit, ctx.currency),
      txn_credit: toDecimal(line.credit, ctx.currency),
      exchange_rate: ctx.rate,
      rate_type: "SPOT",
      rate_date: ctx.entryDate,
    })),
    {
      functionalCurrency: ctx.functionalCurrency,
      entryDate: ctx.entryDate,
      roundingAccountId: ctx.roundingAccountId,
    },
  );
}

/** One payment settling (part of) one invoice; either side may be foreign. */
export interface PaymentSettlement {
  /** Cash received, in `paymentCurrency`. */
  amount: number;
  paymentCurrency: string;
  /** Amount applied to the invoice, in `invoiceCurrency`. */
  invoiceAmount: number;
  invoiceCurrency: string;
  functionalCurrency: string;
  /** Invoice booked rate (functional units per one invoice unit). */
  bookedRate: string;
  /** Payment-date rate of the foreign currency involved (functional per one unit). */
  settlementRate: string;
}

const rateFor = (currency: string, functionalCurrency: string, rate: string): string =>
  currency === functionalCurrency ? "1" : rate;

/** Raised when payment and invoice currencies cannot be settled against each other. */
export class UnsupportedSettlementError extends Error {
  constructor(paymentCurrency: string, invoiceCurrency: string) {
    super(
      `A ${invoiceCurrency} invoice can be paid in ${invoiceCurrency} or the functional currency, not ${paymentCurrency}`,
    );
    this.name = "UnsupportedSettlementError";
  }
}

/**
 * The amount a payment applies to its invoice, in the invoice currency. Same
 * currency settles 1:1; otherwise one side is functional and the other converts
 * at the payment-date (settlement) rate.
 */
export function settlementInvoiceAmount(
  input: Omit<PaymentSettlement, "invoiceAmount" | "bookedRate">,
): number {
  const { amount, paymentCurrency, invoiceCurrency, functionalCurrency, settlementRate } = input;
  if (paymentCurrency === invoiceCurrency) return amount;
  const paid = toDocumentMoney(amount, paymentCurrency);
  if (paymentCurrency === functionalCurrency) {
    return Number(
      moneyToDecimalString(convertMoney(paid, invertExchangeRate(settlementRate), invoiceCurrency)),
    );
  }
  if (invoiceCurrency === functionalCurrency) {
    return Number(moneyToDecimalString(convertMoney(paid, settlementRate, invoiceCurrency)));
  }
  throw new UnsupportedSettlementError(paymentCurrency, invoiceCurrency);
}

/**
 * Realized FX (IAS 21.28): cash received in the functional currency minus the
 * receivable released at the invoice booked rate. Positive = gain.
 */
export function computeRealizedFx(input: PaymentSettlement): Money {
  const { functionalCurrency } = input;
  return subtractMoney(
    convertMoney(
      toDocumentMoney(input.amount, input.paymentCurrency),
      rateFor(input.paymentCurrency, functionalCurrency, input.settlementRate),
      functionalCurrency,
    ),
    convertMoney(
      toDocumentMoney(input.invoiceAmount, input.invoiceCurrency),
      rateFor(input.invoiceCurrency, functionalCurrency, input.bookedRate),
      functionalCurrency,
    ),
  );
}

export interface FxPaymentPostingInput extends PaymentSettlement {
  paymentId: string;
  description: string;
  date: string;
  accounts: LedgerPostingAccounts;
}

/** Raised when a payment produces realized FX but no gain/loss account is configured. */
export class MissingFxAccountError extends Error {
  constructor() {
    super(
      "Configure a realized FX gain/loss account in posting rules before settling at a new rate",
    );
    this.name = "MissingFxAccountError";
  }
}

/**
 * Dr Cash in the payment currency at the settlement rate / Cr AR in the invoice
 * currency at the booked rate, with the difference to the realized FX account
 * (Cr for a gain, Dr for a loss). Partial payments release the booked amount
 * pro rata because AR is credited at the booked rate on exactly the applied part.
 */
export function buildFxPaymentPostingLines(input: FxPaymentPostingInput): JournalLine[] | null {
  const { accounts, functionalCurrency, description, date } = input;
  if (!hasPaymentPostingAccounts(accounts) || input.amount <= 0) return null;
  // Functional-currency sides carry their amount in debit/credit; the resolver
  // derives functional amounts from txn_* only for foreign lines.
  const side = (currency: string, amount: number, debit: boolean, rate: string) => ({
    description,
    debit: currency === functionalCurrency && debit ? amount : 0,
    credit: currency === functionalCurrency && !debit ? amount : 0,
    txn_currency: currency,
    txn_debit: toDecimal(debit ? amount : 0, currency),
    txn_credit: toDecimal(debit ? 0 : amount, currency),
    exchange_rate: rateFor(currency, functionalCurrency, rate),
    rate_type: "SPOT" as const,
    rate_date: date,
  });
  const lines: JournalLine[] = [
    {
      id: "pl-cash",
      account_id: accounts.cashAccountId as string,
      ...side(input.paymentCurrency, input.amount, true, input.settlementRate),
    },
    {
      id: "pl-ar",
      account_id: accounts.arAccountId as string,
      ...side(input.invoiceCurrency, input.invoiceAmount, false, input.bookedRate),
    },
  ];
  const realized = computeRealizedFx(input);
  if (realized.minor !== 0n) {
    if (!accounts.fxRealizedAccountId) throw new MissingFxAccountError();
    const magnitude = realized.minor < 0n ? -realized.minor : realized.minor;
    const value = Number(moneyToDecimalString({ ...realized, minor: magnitude }));
    lines.push({
      id: "pl-fx",
      account_id: accounts.fxRealizedAccountId,
      debit: realized.minor < 0n ? value : 0,
      credit: realized.minor > 0n ? value : 0,
      description: `Realized FX: ${description}`,
    });
  }
  return resolveJournalFxLines(lines, { functionalCurrency, entryDate: date });
}

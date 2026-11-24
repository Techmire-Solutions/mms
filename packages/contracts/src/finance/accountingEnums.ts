/**
 * Canonical Finance/Accounting vocabulary: account types, normal balances, journal
 * lifecycle, fiscal-year and posting-period states, exchange-rate sources, payment
 * methods and journal tags.
 *
 * Every Zod schema, DB check constraint and frontend label must derive from these
 * constants — the audit found the account types re-inlined in two schemas, the
 * journal status in three, the fiscal-year states in two, a third payment-method
 * list in the preferences UI, and a frontend-only journal-tag vocabulary that did
 * not include a tag the backend writes.
 */

export const ACCOUNTING_ACCOUNT_TYPES = [
  "Asset",
  "Liability",
  "Equity",
  "Revenue",
  "Expense",
] as const;

export type AccountingAccountType = (typeof ACCOUNTING_ACCOUNT_TYPES)[number];

/**
 * The subtype vocabulary offered for each account type.
 *
 * This is the UI list **and** the seed's source of truth: `DEFAULT_CHART_OF_ACCOUNTS`
 * uses several caption-style values (`Current Assets`, `Cost of Sales`, `Other
 * Income`, …) that predate the singular entries, so both spellings stay here — a
 * pinned test (`accountingDefaultChart.test.ts`) rejects any chart subtype missing
 * from this list, which is what caught the previous drift.
 */
export const ACCOUNT_SUBTYPES: Record<AccountingAccountType, string[]> = {
  Asset: [
    "Current Asset",
    "Fixed Asset",
    "Contra Asset",
    "Other Asset",
    // Capitalised captions used by the seeded default chart.
    "Current Assets",
    "Fixed Assets",
    "Cash & Bank",
  ],
  Liability: [
    "Current Liability",
    "Long-term Liability",
    "Other Liability",
    "Current Liabilities",
    "Long-Term Liabilities",
  ],
  Equity: ["Owner's Equity", "Retained Earnings", "Other Equity", "Equity"],
  Revenue: ["Operating Revenue", "Non-operating Revenue", "Other Revenue", "Other Income"],
  Expense: [
    "Operating Expense",
    "Administrative Expense",
    "Financial Expense",
    "Other Expense",
    // Seeded default-chart expense families.
    "Cost of Sales",
    "Operating Expenses",
    "Other Expenses",
    "Tax & Exceptional",
  ],
};

/** The side an account's balance grows on. Asset/Expense are debit-normal. */
export type NormalBalance = "debit" | "credit";

export const ACCOUNT_TYPE_NORMAL_BALANCE: Record<AccountingAccountType, NormalBalance> = {
  Asset: "debit",
  Liability: "credit",
  Equity: "credit",
  Revenue: "credit",
  Expense: "debit",
};

export function normalBalanceForAccountType(type: string): NormalBalance {
  return (
    (ACCOUNT_TYPE_NORMAL_BALANCE as Record<string, NormalBalance | undefined>)[type] ?? "debit"
  );
}

export function isDebitNormalAccountType(type: string): boolean {
  return normalBalanceForAccountType(type) === "debit";
}

export function isAccountingAccountType(value: string): value is AccountingAccountType {
  return (ACCOUNTING_ACCOUNT_TYPES as readonly string[]).includes(value);
}

/**
 * Narrow a DB/config account type. Throws rather than guessing: a value outside
 * the enum means the DB check constraint and the shared enum have drifted, which
 * must fail loudly instead of mis-classifying a balance.
 */
export function accountTypeFromDb(value: string): AccountingAccountType {
  if (!isAccountingAccountType(value)) {
    throw new Error(`Unknown accounting account type "${value}" — enum and DB constraint drifted`);
  }
  return value;
}

/**
 * Journal states persisted in `accounting_entries.status` (DB check constraint
 * `accounting_entries_status_chk`). A reversed entry keeps `posted`; reversal is a
 * linked entry, not a status, and `voided` is not a modeled state (invoice
 * `cancelled` is the void analogue).
 */
export const JOURNAL_ENTRY_STATUSES = ["draft", "posted"] as const;
export type JournalEntryStatus = (typeof JOURNAL_ENTRY_STATUSES)[number];

export function isJournalEntryStatus(value: string): value is JournalEntryStatus {
  return (JOURNAL_ENTRY_STATUSES as readonly string[]).includes(value);
}

/**
 * Lifecycle view over the stored status: a posted entry with an active reversal is
 * "reversed". Derived, never stored.
 */
export const JOURNAL_ENTRY_LIFECYCLE = ["draft", "posted", "reversed"] as const;
export type JournalEntryLifecycle = (typeof JOURNAL_ENTRY_LIFECYCLE)[number];

/** The candidates the reversal rule needs — structural, so no import cycle. */
export interface ReversalEntryLike {
  id: string;
  ref?: string | null;
  status?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  reversed_ref?: string | null;
}

/**
 * True when `entry` already has an active reversal.
 *
 * Matches the backend lookup (`findActiveReversalOf`): a reversal entry whose
 * `source_id` is the original id OR whose `reversed_ref` is the original ref. The
 * frontend previously checked only `reversed_ref`, so the UI could offer a reversal
 * the server then rejected.
 */
export function isJournalEntryReversed(
  entry: { id: string; ref?: string | null },
  entries: readonly ReversalEntryLike[],
): boolean {
  return entries.some(
    (candidate) =>
      candidate.id !== entry.id &&
      ((candidate.source_type === "reversal" && candidate.source_id === entry.id) ||
        Boolean(entry.ref && candidate.reversed_ref === entry.ref)),
  );
}

export const FISCAL_YEAR_STATUSES = ["active", "closed", "upcoming"] as const;
export type FiscalYearStatus = (typeof FISCAL_YEAR_STATUSES)[number];

/** `accounting_posting_periods_status_check` allows exactly these. */
export const POSTING_PERIOD_STATUSES = ["open", "closed"] as const;
export type PostingPeriodStatus = (typeof POSTING_PERIOD_STATUSES)[number];

/**
 * Where an exchange rate came from: entered by a user, a scheduled feed, an IAS 21
 * estimate, or the synthetic `identity` rate for a same-currency lookup.
 */
export const EXCHANGE_RATE_SOURCES = ["manual", "feed", "estimate", "identity"] as const;
export type ExchangeRateSource = (typeof EXCHANGE_RATE_SOURCES)[number];

export function isExchangeRateSource(value: string): value is ExchangeRateSource {
  return (EXCHANGE_RATE_SOURCES as readonly string[]).includes(value);
}

/** Narrows a stored/source string to the enum; unknown historical values read as manual. */
export function coerceExchangeRateSource(value: string): ExchangeRateSource {
  return isExchangeRateSource(value) ? value : "manual";
}

/**
 * Canonical payment methods for invoices/payments and the settings picker.
 *
 * Stored payments use the capitalized labels ("Cash"); the legacy settings/API
 * vocabulary used lowercase snake_case (`cash`, `bank_transfer`). Both normalize to
 * these values at the boundary.
 */
export const FINANCE_PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Online",
  "Cheque",
  "Card",
  "Other",
] as const;
export type FinancePaymentMethod = (typeof FINANCE_PAYMENT_METHODS)[number];

const PAYMENT_METHOD_ALIASES: Record<string, FinancePaymentMethod> = {
  cash: "Cash",
  "bank transfer": "Bank Transfer",
  bank_transfer: "Bank Transfer",
  banktransfer: "Bank Transfer",
  card: "Card",
  cheque: "Cheque",
  check: "Cheque",
  online: "Online",
  other: "Other",
};

/** Narrows a stored method to the canonical enum; unknown historical values read as Other. */
export function coerceFinancePaymentMethod(value: string): FinancePaymentMethod {
  const normalized = normalizePaymentMethod(value);
  return (FINANCE_PAYMENT_METHODS as readonly string[]).includes(normalized)
    ? (normalized as FinancePaymentMethod)
    : "Other";
}

/** Maps a legacy/lowercase method to its canonical label; unknown values pass through. */
export function normalizePaymentMethod(value: string): string {
  const trimmed = value.trim();
  const canonical = (FINANCE_PAYMENT_METHODS as readonly string[]).find(
    (method) => method.toLowerCase() === trimmed.toLowerCase(),
  );
  return canonical ?? PAYMENT_METHOD_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Journal tags written by the app. Backend code must use the constants below so a
 * server-created tag can never fall outside the filter vocabulary (previously the
 * backend wrote "Prior Period", which the frontend list did not contain).
 */
export const JOURNAL_TAGS = [
  "Payroll",
  "Fees",
  "Donation",
  "Obligation",
  "Utilities",
  "Rent",
  "Capital",
  "Expense",
  "Adjustment",
  "Reversal",
  "Prior Period",
  "Opening",
] as const;
export type JournalTag = (typeof JOURNAL_TAGS)[number];

export const JOURNAL_TAG_PAYROLL: JournalTag = "Payroll";
export const JOURNAL_TAG_REVERSAL: JournalTag = "Reversal";
export const JOURNAL_TAG_PRIOR_PERIOD: JournalTag = "Prior Period";

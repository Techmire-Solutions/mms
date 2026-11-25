/**
 * Financial ledger and money display data contracts (SSOT).
 * Shared between backend report generators, exports, and frontend table primitives.
 */

export interface FinancialLedgerRow {
  /** Account name or label displayed in the first column. */
  account: string;
  /** Formatted debit amount string, or undefined if this is a credit row. */
  debit?: string;
  /** Formatted credit amount string, or undefined if this is a debit row. */
  credit?: string;
  /** Controls the row background colour. Defaults to 'neutral'. */
  variant?: "debit" | "credit" | "neutral";
}

export interface MoneyDisplayConfig {
  locale?: string;
  currency?: string;
  useSymbol?: boolean;
  excludeCurrency?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

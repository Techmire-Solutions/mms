import { boolean, numeric, varchar } from "drizzle-orm/pg-core";

/**
 * IAS 21 dual-amount columns shared by ledger line tables. `txn_*` is the
 * document currency; `func_*` is the tenant's functional currency. Nullable
 * until the backfill has run (expand/contract), then tightened to NOT NULL.
 */
export const fxLineColumns = {
  txnCurrency: varchar("txn_currency", { length: 3 }),
  txnDebit: numeric("txn_debit", { precision: 19, scale: 4 }),
  txnCredit: numeric("txn_credit", { precision: 19, scale: 4 }),
  exchangeRate: numeric("exchange_rate", { precision: 20, scale: 10 }),
  rateType: varchar("rate_type", { length: 16 }),
  rateDate: varchar("rate_date", { length: 10 }),
  funcDebit: numeric("func_debit", { precision: 19, scale: 4 }),
  funcCredit: numeric("func_credit", { precision: 19, scale: 4 }),
};

/** IAS 21 classification columns on `accounting_accounts`. */
export const fxAccountColumns = {
  /** Monetary item (cash, bank, receivables, payables): retranslated at the closing rate. */
  isMonetary: boolean("is_monetary").notNull().default(false),
  /** When set, every line on this account must be in this currency (e.g. a USD bank account). */
  accountCurrency: varchar("account_currency", { length: 3 }),
  allowRevaluation: boolean("allow_revaluation").notNull().default(true),
};

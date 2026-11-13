/**
 * The 422 error shape the ledger guards use.
 *
 * Its own module so both `accountingLedgerGuards` and
 * `accountingAccountPostability` can raise it without importing each other.
 */
export type AccountingLedgerHttpError = Error & {
  statusCode: number;
  type: "validation_error";
  /** Stable discriminator surfaced as `code`; the coarse `type` stays unchanged. */
  code?: string;
};

/**
 * A 422 ledger rejection. `code` (from `ACCOUNTING_ERROR_CODES`) is what clients
 * branch on: unbalanced, period closed, year locked, non-postable account and
 * account currency lock all share `type: "validation_error"`.
 */
export function ledgerError(message: string, code?: string): AccountingLedgerHttpError {
  const error = new Error(message) as AccountingLedgerHttpError;
  error.statusCode = 422;
  error.type = "validation_error";
  if (code) error.code = code;
  return error;
}

/**
 * IAS 21 account classification: which chart-of-accounts rows are monetary
 * items (retranslated at the closing rate) versus non-monetary (kept at the
 * historical rate).
 */

interface AccountClassificationInput {
  type: string;
  subtype: string;
  name: string;
}

const MONETARY_ASSET_NAME =
  /\b(cash|bank|petty|receivable|debtors?|loan|deposit|wallet|jazzcash|easypaisa)\b/i;
const NON_MONETARY_LIABILITY_NAME = /\b(unearned|deferred|advance[sd]?\s+(from|received))\b/i;

/**
 * Best-effort default for `accounting_accounts.is_monetary`: cash, bank,
 * receivables and loans on the asset side; liabilities except unearned or
 * deferred revenue and advances received (settled in goods or services, not
 * cash). Equity, revenue and expense accounts are never monetary. The flag stays
 * editable on the account because names are free text.
 */
export function inferIsMonetaryAccount(account: AccountClassificationInput): boolean {
  if (account.type === "Asset") {
    return (
      account.subtype !== "Fixed Asset" &&
      account.subtype !== "Contra Asset" &&
      MONETARY_ASSET_NAME.test(account.name)
    );
  }
  if (account.type === "Liability") {
    return !NON_MONETARY_LIABILITY_NAME.test(account.name);
  }
  return false;
}

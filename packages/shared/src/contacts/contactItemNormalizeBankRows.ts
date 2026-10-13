import type { ContactBankDetail } from "./contactEntityTypes.js";
import { BANK_DETAIL_SYSTEM_KEYS } from "./contactItemNormalizeKeys.js";
import {
  retainExtraKeys,
  type ContactItemNormalizeDefaults,
} from "./contactItemNormalizeRowsShared.js";

/**
 * Normalizes a single Bank Detail entry into a valid ContactBankDetail object.
 */
export function normalizeBankDetailItem(
  item: unknown,
  _defaults: ContactItemNormalizeDefaults = {},
): ContactBankDetail {
  if (!item || typeof item !== "object") {
    return {
      bankName: typeof item === "string" ? item.trim() : "",
      accountTitle: "",
      accountNumber: "",
    };
  }

  const obj = item as Record<string, unknown>;
  const bankName = String(obj.bankName || obj.bank || "").trim();
  const accountTitle = String(obj.accountTitle || obj.title || "").trim();
  const accountNumber = String(
    obj.accountNumber || obj.accountNo || obj.iban || obj.value || "",
  ).trim();

  return {
    ...retainExtraKeys(obj, BANK_DETAIL_SYSTEM_KEYS),
    bankName: bankName || undefined,
    accountTitle: accountTitle || undefined,
    accountNumber: accountNumber || undefined,
  };
}

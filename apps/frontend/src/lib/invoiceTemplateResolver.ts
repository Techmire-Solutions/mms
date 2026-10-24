import { DEFAULT_CURRENCY_CODE, formatAmountInWords, formatDate, formatMoney } from "@mms/shared";
import type {
  FieldLookupInfo,
  IndexedFieldLookups,
  InvoiceTemplateFieldKey,
  LookupItem,
} from "./invoiceTemplateTypes";

/**
 * Pre-indexes lookup collections into O(1) maps for high-performance template rendering.
 */
export function indexLookups(lookups?: FieldLookupInfo): IndexedFieldLookups {
  const indexArr = (arr?: LookupItem[]): Map<string, LookupItem> => {
    const map = new Map<string, LookupItem>();
    if (!arr) return map;
    for (const item of arr) {
      if (item.id != null) {
        const key = String(item.id).trim().toLowerCase();
        if (key && !map.has(key)) map.set(key, item);
      }
      if (item.code) {
        const codeKey = String(item.code).trim().toLowerCase();
        if (codeKey && !map.has(codeKey)) map.set(codeKey, item);
      }
    }
    return map;
  };

  return {
    contacts: indexArr(lookups?.contacts),
    users: indexArr(lookups?.users),
    obligationTypes: indexArr(lookups?.obligationTypes),
    mujtahids: indexArr(lookups?.mujtahids),
    reps: indexArr(lookups?.reps),
    currencies: indexArr(lookups?.currencies),
    branding: lookups?.branding,
  };
}

const stringifyFieldValue = (val: unknown): string => {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean" || typeof val === "bigint") {
    return String(val);
  }
  if (val instanceof Date) return val.toISOString();
  return "";
};

const findItem = (
  source?: LookupItem[] | Map<string, LookupItem>,
  id?: unknown,
): LookupItem | undefined => {
  if (!source || id == null) return undefined;
  const target = String(id).trim().toLowerCase();
  if (!target) return undefined;

  if (source instanceof Map) {
    return source.get(target);
  }

  return source.find(
    (item) =>
      item.id === id ||
      item.code === id ||
      (item.id != null && String(item.id).trim().toLowerCase() === target) ||
      (item.code != null && String(item.code).trim().toLowerCase() === target),
  );
};

const resolveCurrencyCode = (
  currencies?: LookupItem[] | Map<string, LookupItem>,
  currencyId?: unknown,
): string => {
  if (currencyId == null) return DEFAULT_CURRENCY_CODE;
  const found = findItem(currencies, currencyId);
  if (found?.code && typeof found.code === "string") return found.code.trim().toUpperCase();
  const raw = String(currencyId).trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  return DEFAULT_CURRENCY_CODE;
};

/**
 * Resolves a dynamic field's string value using database records and lookup mappings.
 */
export function resolveField(
  field: InvoiceTemplateFieldKey | string,
  collection?: Record<string, unknown> | null,
  lookups?: FieldLookupInfo | IndexedFieldLookups,
): string {
  if (!collection) return "";
  const { contacts, users, obligationTypes, mujtahids, reps, currencies, branding } = lookups || {};

  switch (field) {
    case "receipt_no":
      return String(collection.receipt_no || "");
    case "received_date":
      return collection.received_date ? formatDate(collection.received_date as string) : "";
    case "sender":
      return String(findItem(contacts, collection.sender_id)?.name || collection.sender_id || "");
    case "sender_phone":
      return String(findItem(contacts, collection.sender_id)?.phone || "");
    case "sender_email":
      return String(findItem(contacts, collection.sender_id)?.email || "");
    case "reference":
      return String(
        findItem(contacts, collection.reference_id)?.name || collection.reference_id || "",
      );
    case "reference_phone":
      return String(findItem(contacts, collection.reference_id)?.phone || "");
    case "reference_email":
      return String(findItem(contacts, collection.reference_id)?.email || "");
    case "obligation_type":
      return String(
        findItem(obligationTypes, collection.obligation_type_id)?.name ||
          collection.obligation_type_id ||
          "",
      );
    case "mujtahid": {
      const rep = findItem(reps, collection.mujtahid_representative_id);
      return rep ? String(findItem(mujtahids, rep.mujtahid_id)?.name || "") : "";
    }
    case "representative":
      return String(findItem(reps, collection.mujtahid_representative_id)?.name || "");
    case "amount": {
      if (collection.amount == null || collection.amount === "") return "";
      const num = Number(collection.amount);
      if (!Number.isFinite(num)) return "";
      const currencyCode = resolveCurrencyCode(currencies, collection.currency_id);
      return formatMoney(num, currencyCode);
    }
    case "amount_in_words": {
      if (collection.amount == null || collection.amount === "") return "";
      const num = Number(collection.amount);
      if (!Number.isFinite(num)) return "";
      const currencyCode = resolveCurrencyCode(currencies, collection.currency_id);
      return formatAmountInWords(num, currencyCode);
    }
    case "currency":
      return resolveCurrencyCode(currencies, collection.currency_id);
    case "payment_mode":
      return String(collection.payment_mode || "");
    case "received_by":
      return String(findItem(users, collection.received_by)?.name || collection.received_by || "");
    case "institution_name":
      return String(
        branding?.madrasaName || collection.institution_name || collection.institution || "",
      );
    case "institution_phone":
      return String(branding?.phone || collection.institution_phone || "");
    case "institution_email":
      return String(branding?.email || collection.institution_email || "");
    case "institution_address": {
      const addressParts = [branding?.addressLine1, branding?.addressLine2, branding?.city].filter(
        Boolean,
      );
      if (addressParts.length > 0) {
        return addressParts.join(", ");
      }
      return String(collection.institution_address || "");
    }
    default: {
      if (collection[field] != null && collection[field] !== "") {
        return stringifyFieldValue(collection[field]);
      }
      let customData = collection.custom_data;
      if (typeof customData === "string") {
        try {
          customData = JSON.parse(customData);
        } catch {
          // Ignore JSON parse error
        }
      }
      if (customData && typeof customData === "object" && field in customData) {
        return stringifyFieldValue((customData as Record<string, unknown>)[field]);
      }
      return "";
    }
  }
}

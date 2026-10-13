import {
  DEFAULT_ADDRESS_LABELS,
  DEFAULT_EMAIL_LABELS,
  DEFAULT_PHONE_LABELS,
  type PhoneNumber as ContactPhone,
  type EmailAddress as ContactEmail,
  type Address as ContactAddress,
} from "./contactTypes.js";
import { parsePhoneNumber } from "../core/phoneUtils.js";
import {
  PHONE_SYSTEM_KEYS,
  EMAIL_SYSTEM_KEYS,
  ADDRESS_SYSTEM_KEYS,
} from "./contactItemNormalizeKeys.js";
import {
  retainExtraKeys,
  type ContactItemNormalizeDefaults,
} from "./contactItemNormalizeRowsShared.js";

/**
 * Normalizes a single Phone entry into a valid PhoneNumber object.
 */
export function normalizePhoneItem(
  item: unknown,
  index = 0,
  defaultCode = "",
  defaults: ContactItemNormalizeDefaults = {},
): ContactPhone {
  const resolvedDefaultCode = defaults.defaultPhoneCountryCode || defaultCode || "";
  const defaultLabel = defaults.phoneLabel || DEFAULT_PHONE_LABELS[0] || "Mobile";
  if (!item)
    return {
      label: defaultLabel,
      number: "",
      countryCode: resolvedDefaultCode,
      isPrimary: index === 0,
    };
  if (typeof item === "string") {
    const parsed = parsePhoneNumber(item.trim(), resolvedDefaultCode);
    return {
      label: defaultLabel,
      number: parsed.number || item.trim(),
      countryCode: parsed.countryCode || resolvedDefaultCode,
      isPrimary: index === 0,
    };
  }
  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const rawNum = String(obj.number || obj.phone || obj.value || obj.num || "").trim();
    const label = String(obj.label || obj.type || defaultLabel).trim() || defaultLabel;
    const countryCode =
      String(obj.countryCode || obj.code || resolvedDefaultCode).trim() || resolvedDefaultCode;
    const isPrimary = typeof obj.isPrimary === "boolean" ? obj.isPrimary : index === 0;
    const rawStatus = obj.whatsappStatus;
    const whatsappStatus: ContactPhone["whatsappStatus"] =
      rawStatus === "UNCHECKED" ? "PENDING" : (rawStatus as ContactPhone["whatsappStatus"]);
    const parsed = parsePhoneNumber(rawNum, countryCode);
    return {
      ...retainExtraKeys(obj, PHONE_SYSTEM_KEYS),
      label,
      number: parsed.number || rawNum,
      countryCode: parsed.countryCode || countryCode,
      isPrimary,
      whatsappStatus,
    };
  }
  return {
    label: defaultLabel,
    number: "",
    countryCode: resolvedDefaultCode,
    isPrimary: index === 0,
  };
}

/**
 * Normalizes a single Email entry into a valid EmailAddress object.
 */
export function normalizeEmailItem(
  item: unknown,
  index = 0,
  defaults: ContactItemNormalizeDefaults = {},
): ContactEmail {
  const defaultLabel = defaults.emailLabel || DEFAULT_EMAIL_LABELS[0] || "Personal";
  if (!item) return { label: defaultLabel, address: "", isPrimary: index === 0 };
  if (typeof item === "string") {
    return { label: defaultLabel, address: item.trim(), isPrimary: index === 0 };
  }
  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const address = String(obj.address || obj.email || obj.value || "").trim();
    const label = String(obj.label || obj.type || defaultLabel).trim() || defaultLabel;
    const isPrimary = typeof obj.isPrimary === "boolean" ? obj.isPrimary : index === 0;
    const isVerified = typeof obj.isVerified === "boolean" ? obj.isVerified : undefined;
    return { ...retainExtraKeys(obj, EMAIL_SYSTEM_KEYS), label, address, isPrimary, isVerified };
  }
  return { label: defaultLabel, address: "", isPrimary: index === 0 };
}

/**
 * Normalizes a single Address entry into a valid Address object.
 */
export function normalizeAddressItem(
  item: unknown,
  defaultCity = "",
  defaultProvince = "",
  defaultCountry = "",
  index = 0,
  defaults: ContactItemNormalizeDefaults = {},
): ContactAddress {
  const defaultLabel = defaults.addressLabel || DEFAULT_ADDRESS_LABELS[0] || "Home";
  if (!item) {
    return {
      label: defaultLabel,
      line1: "",
      city: defaultCity,
      state: defaultProvince,
      country: defaultCountry,
      isPrimary: index === 0,
    };
  }
  if (typeof item === "string") {
    return {
      label: defaultLabel,
      line1: item.trim(),
      city: defaultCity,
      state: defaultProvince,
      country: defaultCountry,
      isPrimary: index === 0,
    };
  }
  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const line1 = String(obj.line1 || obj.address || obj.street || obj.value || "").trim();
    const city = String(obj.city || defaultCity).trim();
    const state = String(obj.state || obj.province || defaultProvince).trim();
    const country = String(obj.country || defaultCountry).trim();
    const label = String(obj.label || obj.type || defaultLabel).trim() || defaultLabel;
    const isPrimary = typeof obj.isPrimary === "boolean" ? obj.isPrimary : index === 0;
    return {
      ...retainExtraKeys(obj, ADDRESS_SYSTEM_KEYS),
      label,
      line1,
      city,
      state,
      country,
      isPrimary,
    };
  }
  return {
    label: defaultLabel,
    line1: "",
    city: defaultCity,
    state: defaultProvince,
    country: defaultCountry,
    isPrimary: index === 0,
  };
}

import type { Contact } from "./contactTypes.js";
import { getPrimaryEmail, getPrimaryPhone } from "../core/utils.js";

/** Normalizes a string for search comparison by stripping diacritics/accents and standardizing common Arabic/Urdu/Persian letters. */
export function normalizeSearchString(val?: string | null): string {
  if (typeof val !== "string") return "";
  return val
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove English/Latin diacritics
    .replace(/[\u064B-\u065F\u0670]/g, "") // remove Arabic/Urdu short vowels (harakat/tashkeel/diacritics)
    .replace(/ي/g, "ی") // normalize Arabic Yeh to Farsi/Urdu Yeh
    .replace(/ك/g, "ک") // normalize Arabic Kaf to Persian/Urdu Kaf
    .toLowerCase();
}

/** Approved Work-tab search haystack (globle1 §3.2). */
export function getContactSearchHaystack(contact?: Contact | null): string {
  if (!contact || typeof contact !== "object") return "";
  const parts: Array<string | null | undefined> = [
    contact.name,
    contact.firstName,
    contact.lastName,
    contact.cnic,
    getPrimaryPhone(contact),
    contact.phone,
    ...(contact.phones || []).map((p) => p?.number),
    getPrimaryEmail(contact),
    contact.email,
    ...(contact.emails || []).map((email) => email?.address),
    ...(contact.addresses || []).map((address) =>
      address
        ? [address.city, address.state, address.country, address.line1].filter(Boolean).join(" ")
        : "",
    ),
  ];
  return normalizeSearchString(parts.filter((part): part is string => Boolean(part)).join(" "));
}

export function contactMatchesSearch(contact?: Contact | null, query?: string | null): boolean {
  if (!contact || typeof contact !== "object") return false;
  const normalizedQuery = normalizeSearchString(typeof query === "string" ? query.trim() : "");
  if (!normalizedQuery) return true;
  const haystack = getContactSearchHaystack(contact);
  if (normalizedQuery.includes("*") || normalizedQuery.includes("?")) {
    const regexPattern = normalizedQuery
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    try {
      return new RegExp(regexPattern, "i").test(haystack);
    } catch {
      return haystack.includes(normalizedQuery);
    }
  }
  return haystack.includes(normalizedQuery);
}

import {
  getDisplayName,
  getEmails,
  getPhoneNumbers,
  normalizeUniqueContactFieldValue,
  type Contact,
  type ContactIdentityMatchBody,
  type ContactIdentityMatchResult,
} from "@mms/shared";

/** Build identity-match candidates from an Apple VCF preview list. */
export function buildAppleImportIdentityCandidates(
  previewList: Contact[],
  defaultPhoneCountryCode: string,
): ContactIdentityMatchBody {
  const phones: string[] = [];
  const emails: string[] = [];
  const names: string[] = [];

  for (const contact of previewList) {
    for (const phone of contact.phones ?? []) {
      const normalized = normalizeUniqueContactFieldValue("phones", "number", phone.number, {
        defaultPhoneCountryCode,
        row: { countryCode: phone.countryCode, number: phone.number },
      });
      if (normalized) phones.push(normalized);
      const comparison = getPhoneNumbers({ phones: [phone] } as Contact);
      phones.push(...comparison);
    }
    emails.push(
      ...getEmails(contact)
        .map((email) => email.toLowerCase().trim())
        .filter(Boolean),
    );

    const hasPhone = getPhoneNumbers(contact).length > 0;
    const hasEmail = getEmails(contact).length > 0;
    if (!hasPhone && !hasEmail) {
      const name = getDisplayName(contact).toLowerCase().trim();
      if (name) names.push(name);
    }
  }

  return {
    phones: [...new Set(phones.filter(Boolean))],
    emails: [...new Set(emails.filter(Boolean))],
    names: [...new Set(names.filter(Boolean))],
  };
}

export function filterAppleImportFreshContacts(
  previewList: Contact[],
  existing: { phones: string[]; emails: string[]; names: string[] },
): Contact[] {
  const existingPhones = new Set(existing.phones);
  const existingEmails = new Set(existing.emails);
  const existingNames = new Set(existing.names);

  return previewList.filter((contact) => {
    const phones = getPhoneNumbers(contact);
    const emails = getEmails(contact).map((email) => email.toLowerCase().trim());
    if (phones.some((phone) => existingPhones.has(phone))) return false;
    // Also match E.164 digit keys when preview phones were normalized that way.
    for (const phone of contact.phones ?? []) {
      const digits = String(phone.number || "").replace(/\D/g, "");
      const withCountry = `${String(phone.countryCode || "").replace(/\D/g, "")}${digits}`;
      if (existingPhones.has(digits) || existingPhones.has(withCountry)) return false;
    }
    if (emails.some((email) => existingEmails.has(email))) return false;
    if (phones.length === 0 && emails.length === 0) {
      const name = getDisplayName(contact).toLowerCase().trim();
      return !name || !existingNames.has(name);
    }
    return true;
  });
}

/** Server schema caps each identity list at 2,000 values; chunk well below it. */
export const APPLE_IDENTITY_MATCH_MAX_PER_LIST = 2_000;
export const APPLE_IDENTITY_MATCH_CHUNK_SIZE = 500;

function chunkValues(values: readonly string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

/**
 * Runs the identity-match check in chunks.
 *
 * An import may carry up to 5,000 contacts, each contributing phone/email/name
 * keys — far beyond the server's 2,000-values-per-list schema cap. One oversized
 * body would fail validation and abort the whole import, so every list is sent in
 * bounded batches and the existence sets are unioned.
 */
export async function matchAppleImportIdentity(
  candidates: ContactIdentityMatchBody,
  match: (body: ContactIdentityMatchBody) => Promise<ContactIdentityMatchResult>,
): Promise<ContactIdentityMatchResult> {
  if (
    candidates.phones.length === 0 &&
    candidates.emails.length === 0 &&
    candidates.names.length === 0
  ) {
    return { phones: [], emails: [], names: [] };
  }

  const withinServerCap =
    candidates.phones.length <= APPLE_IDENTITY_MATCH_MAX_PER_LIST &&
    candidates.emails.length <= APPLE_IDENTITY_MATCH_MAX_PER_LIST &&
    candidates.names.length <= APPLE_IDENTITY_MATCH_MAX_PER_LIST;
  if (withinServerCap) {
    const result = await match(candidates);
    return {
      phones: [...new Set(result.phones ?? [])],
      emails: [...new Set(result.emails ?? [])],
      names: [...new Set(result.names ?? [])],
    };
  }

  const phones = new Set<string>();
  const emails = new Set<string>();
  const names = new Set<string>();

  const lists: Array<{
    key: "phones" | "emails" | "names";
    values: string[];
    target: Set<string>;
  }> = [
    { key: "phones", values: candidates.phones, target: phones },
    { key: "emails", values: candidates.emails, target: emails },
    { key: "names", values: candidates.names, target: names },
  ];

  for (const { key, values, target } of lists) {
    for (const chunk of chunkValues(values, APPLE_IDENTITY_MATCH_CHUNK_SIZE)) {
      const result = await match({ phones: [], emails: [], names: [], [key]: chunk });
      for (const value of result[key]) target.add(value);
    }
  }

  return { phones: [...phones], emails: [...emails], names: [...names] };
}

/**
 * Removes duplicate rows inside one imported file.
 *
 * Server uniqueness catches most collisions, but a vCard exported twice would
 * otherwise surface as a partial import; dedupe the preview by normalized phone,
 * email, or (for rows with neither) display name before matching against the DB.
 */
export function dedupeAppleImportPreview(previewList: readonly Contact[]): Contact[] {
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  const unique: Contact[] = [];

  for (const contact of previewList) {
    const phones = getPhoneNumbers(contact);
    const emails = getEmails(contact).map((email) => email.toLowerCase().trim());
    const name = getDisplayName(contact).toLowerCase().trim();
    const duplicate =
      phones.some((phone) => seenPhones.has(phone)) ||
      emails.some((email) => seenEmails.has(email)) ||
      (phones.length === 0 && emails.length === 0 && Boolean(name) && seenNames.has(name));
    if (duplicate) continue;

    phones.forEach((phone) => seenPhones.add(phone));
    emails.forEach((email) => seenEmails.add(email));
    if (phones.length === 0 && emails.length === 0 && name) seenNames.add(name);
    unique.push(contact);
  }

  return unique;
}

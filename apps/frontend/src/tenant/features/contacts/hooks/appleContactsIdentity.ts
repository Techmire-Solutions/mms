import {
  getDisplayName,
  getEmails,
  getPhoneNumbers,
  normalizeUniqueContactFieldValue,
  type Contact,
  type ContactIdentityMatchBody,
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

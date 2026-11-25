import type { Contact } from "./contactEntityTypes.js";
import { parseCsvRows } from "../core/csvParserCore.js";
import { HEADER_FIELD_MAP, normalizeHeaderKey } from "./contactsCsvHeaderMap.js";
import {
  buildActivities,
  buildAddresses,
  buildAttachments,
  buildBankDetails,
  buildEducation,
  buildEmails,
  buildExperience,
  buildPhones,
  buildRelationships,
  buildSkills,
  buildSocials,
  cleanCell,
  generateId,
  hasAnyColumn,
  parseBool,
  type ParseContactsRowContext,
} from "./contactsCsvRowParser.js";

export { parseCsvRows, HEADER_FIELD_MAP };

export interface ParseContactsCsvOptions {
  defaultPhoneLabel?: string;
  defaultEmailLabel?: string;
  defaultAddressLabel?: string;
}

function resolveFirstAndLastName(
  firstNameRaw: string,
  lastNameRaw: string,
  rawName: string,
): { firstName: string; lastName: string } {
  let firstName = firstNameRaw;
  let lastName = lastNameRaw;
  if (!firstName && !lastName && rawName) {
    const parts = rawName.split(/\s+/);
    firstName = parts[0] || "";
    lastName = parts.slice(1).join(" ");
  }
  return { firstName, lastName };
}

/**
 * Parses CSV text into an array of Contact objects across all 13 contact tables & audit fields.
 */
export function parseContactsCsv(
  csvText: string,
  options?: ParseContactsCsvOptions,
): { contacts: Contact[]; errors: string[] } {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return {
      contacts: [],
      errors: rows.length === 0 ? ["CSV file is empty"] : ["CSV file has no data rows"],
    };
  }

  const headerRow = rows[0];
  const colMap = new Map<string, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const raw = headerRow[i].trim();
    const fieldKey = HEADER_FIELD_MAP[normalizeHeaderKey(raw)] || raw;
    colMap.set(fieldKey, i);
  }

  const contacts: Contact[] = [];
  const errors: string[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const getVal = (key: string): string => {
      const idx = colMap.get(key);
      return idx !== undefined && row[idx] !== undefined ? cleanCell(row[idx]) : "";
    };

    const ctx: ParseContactsRowContext = {
      getVal,
      hasColumn: (key: string) => colMap.has(key),
      defaultPhoneLabel: options?.defaultPhoneLabel,
      defaultEmailLabel: options?.defaultEmailLabel,
      defaultAddressLabel: options?.defaultAddressLabel,
    };

    const resolvedNames = resolveFirstAndLastName(
      getVal("firstName"),
      getVal("lastName"),
      getVal("name"),
    );
    let { firstName } = resolvedNames;
    const { lastName } = resolvedNames;

    if (!firstName && !lastName) {
      const fallbackPhone = getVal("phone_number");
      const fallbackEmail = getVal("email_address");
      const fallbackCnic = getVal("cnic");
      if (fallbackPhone || fallbackEmail || fallbackCnic) {
        firstName = fallbackPhone || fallbackEmail || fallbackCnic;
      } else {
        errors.push(`Row ${r + 1}: Skipped row without name or identifier`);
        continue;
      }
    }

    const explicitId = getVal("id");
    const avatar = getVal("avatar");
    const whatsappStatus = getVal("whatsappStatus");
    const lastCheckedAt = getVal("lastCheckedAt");
    const aiSummary = getVal("aiSummary");
    const createdAt = getVal("createdAt");
    const updatedAt = getVal("updatedAt");
    const createdBy = getVal("createdBy");
    const updatedBy = getVal("updatedBy");
    const activities = buildActivities(ctx);
    const attachments = buildAttachments(ctx);

    const contact: Contact = {
      id: explicitId || generateId(),
      name: [firstName, lastName].filter(Boolean).join(" "),
      firstName,
      lastName,
      gender: getVal("gender"),
      dob: getVal("dob"),
      cnic: getVal("cnic"),
      isSyed: parseBool(getVal("isSyed")),
      tag: getVal("tag"),
      notes: getVal("notes"),
      ...(avatar ? { avatar } : {}),
      ...(whatsappStatus ? { whatsappStatus: whatsappStatus as Contact["whatsappStatus"] } : {}),
      ...(lastCheckedAt ? { lastCheckedAt } : {}),
      ...(aiSummary ? { aiSummary } : {}),
      // A collection is emitted only when the file carries its columns. An absent
      // column means "not exported", not "empty": sending `[]` for it would clear
      // the stored rows on re-import (R4-04).
      ...(hasAnyColumn(ctx, ["phone_number"]) ? { phones: buildPhones(ctx) } : {}),
      ...(hasAnyColumn(ctx, ["email_address"]) ? { emails: buildEmails(ctx) } : {}),
      ...(hasAnyColumn(ctx, ["line1", "city"]) ? { addresses: buildAddresses(ctx) } : {}),
      ...(hasAnyColumn(ctx, ["socials_platform", "socials_url"])
        ? { socials: buildSocials(ctx) }
        : {}),
      ...(hasAnyColumn(ctx, ["education_institution"]) ? { education: buildEducation(ctx) } : {}),
      ...(hasAnyColumn(ctx, ["experience_title"]) ? { experience: buildExperience(ctx) } : {}),
      ...(hasAnyColumn(ctx, ["skills_name"]) ? { skills: buildSkills(ctx) } : {}),
      ...(hasAnyColumn(ctx, ["relationship_contact"])
        ? { relationshipContacts: buildRelationships(ctx) }
        : {}),
      ...(hasAnyColumn(ctx, ["bank_name"]) ? { bankDetails: buildBankDetails(ctx) } : {}),
      ...(activities.length > 0 ? { activities } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {}),
      ...(createdBy ? { createdBy } : {}),
      ...(updatedBy ? { updatedBy } : {}),
    };

    contacts.push(contact);
  }

  return { contacts, errors };
}

import {
  applyTitleCaseToContact,
  cleanContactDraft,
  normalizeToE164,
  parsePhoneNumber,
  stripContactClientSoftDeleteFields,
  stripContactRetiredClassificationFields,
  syncContactScalarFields,
  type Contact,
} from "@mms/shared";
import { loadContactLookupKind } from "./contactLookupsService.js";
import { loadContactRuntimeDefaults } from "./contactLoadUseCases.js";
import {
  type AssertContactUniqueFieldsOptions,
  ContactUniqueFieldError,
  assertContactUniqueFields,
} from "./contactUniqueValidation.js";
import { validateContactDynamic } from "./contactBlueprintValidation.js";

export {
  type AssertContactUniqueFieldsOptions,
  ContactUniqueFieldError,
  assertContactUniqueFields,
  validateContactDynamic,
};

export const stripClientSoftDeleteFields = stripContactClientSoftDeleteFields;

export class ContactPermissionError extends Error {
  readonly code = "forbidden" as const;

  constructor(message = "Permission denied") {
    super(message);
    this.name = "ContactPermissionError";
  }
}

/** Merge a client patch onto an existing contact, ignoring undefined keys. */
export function mergeContactPatch(existing: Contact, patch: Contact): Contact {
  const next: Contact = { ...existing };
  for (const [key, value] of Object.entries(patch) as [keyof Contact, Contact[keyof Contact]][]) {
    if (value !== undefined) {
      (next as Record<string, unknown>)[key as string] = value;
    }
  }
  return next;
}

async function normalizeContactPhones(contact: Contact): Promise<Contact> {
  let phones = contact.phones;
  const phonesProvided = Array.isArray(contact.phones);
  const { defaultPhoneCountryCode, phoneLabel } = await loadContactRuntimeDefaults();
  const dialDefault = defaultPhoneCountryCode || "";
  const labelDefault = phoneLabel || "Mobile";

  // phones: undefined (not provided) + scalar phone present → rebuild a single row
  if (!phonesProvided && (contact.phone || "").trim()) {
    phones = [
      {
        label: labelDefault,
        number: (contact.phone || "").trim(),
        countryCode: dialDefault,
        isPrimary: true,
      },
    ];
  }

  if (!phones?.length) {
    return { ...contact, phones: phones || [] };
  }

  const countryCodes = (await loadContactLookupKind("countryCodes")) || [];
  const knownCodes = (countryCodes as Array<{ code?: string } | string>)
    .map((row) =>
      row && typeof row === "object" && typeof row.code === "string" ? String(row.code) : "",
    )
    .filter(Boolean);

  return {
    ...contact,
    phones: phones.map((phone) => {
      const fallbackCode = phone.countryCode || dialDefault;
      const trimmedNumber = (phone.number || "").trim();
      const parsedRaw = parsePhoneNumber(trimmedNumber, fallbackCode, knownCodes);
      const e164 = normalizeToE164(parsedRaw.countryCode, parsedRaw.number);
      const parsed = parsePhoneNumber(e164, parsedRaw.countryCode, knownCodes);
      return {
        ...phone,
        countryCode: parsed.countryCode,
        number: parsed.number,
      };
    }),
  };
}

export async function prepareContactRecord(
  contact: Contact,
  id?: string | number,
): Promise<Contact> {
  const cleaned = cleanContactDraft(contact);
  const withPhones = await normalizeContactPhones(cleaned as Contact);
  const withScalars = syncContactScalarFields(withPhones);
  const rawId =
    (typeof id === "string" && id.trim()) ||
    (typeof id === "number" && String(id)) ||
    (typeof withScalars.id === "string" && withScalars.id.trim()) ||
    (typeof withScalars.id === "number" && String(withScalars.id)) ||
    undefined;
  const resolvedId =
    rawId ??
    `temp-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
  const titled = applyTitleCaseToContact({ ...withScalars, id: resolvedId });
  return stripContactRetiredClassificationFields({ ...titled });
}

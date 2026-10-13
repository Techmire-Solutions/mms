import { z } from "zod";

/** Contacts Setup option-list kinds migrated off document-store `collections`. */
export const CONTACT_LOOKUP_KINDS = [
  "genders",
  "socialPlatforms",
  "relationships",
  "phoneLabels",
  "emailLabels",
  "addressLabels",
  "countryCodes",
  "educationDegrees",
  "employmentTypes",
  "skillCategories",
  "skillProficiencies",
  "tags",
  "bankNames",
] as const;

export type ContactLookupKind = (typeof CONTACT_LOOKUP_KINDS)[number];

const contactLookupKindSchema = z.enum(CONTACT_LOOKUP_KINDS);

const contactLookupCountryCodeSchema = z.object({
  country: z.string().min(1).max(200),
  code: z.string().min(1).max(32),
});

export type ContactLookupCountryCode = z.infer<typeof contactLookupCountryCodeSchema>;

const contactLookupStringItemsSchema = z.array(z.string().min(1).max(200)).max(500);

const contactLookupCountryItemsSchema = z.array(contactLookupCountryCodeSchema).max(500);

/** Shape of the per-kind lookup map: string lists, except country codes carry objects. */
export type ContactLookupsMap = {
  genders: string[];
  socialPlatforms: string[];
  relationships: string[];
  phoneLabels: string[];
  emailLabels: string[];
  addressLabels: string[];
  countryCodes: ContactLookupCountryCode[];
  educationDegrees: string[];
  employmentTypes: string[];
  skillCategories: string[];
  skillProficiencies: string[];
  tags: string[];
  bankNames: string[];
};

export const contactLookupKindParamsSchema = z.object({
  kind: contactLookupKindSchema,
});

export const contactLookupPutBodySchema = z.object({
  items: z.union([contactLookupStringItemsSchema, contactLookupCountryItemsSchema]),
});

const CONTACT_LOOKUP_KINDS_SET = new Set<string>(CONTACT_LOOKUP_KINDS);

export function isContactLookupKind(value: string): value is ContactLookupKind {
  return CONTACT_LOOKUP_KINDS_SET.has(value);
}

export function isContactLookupCountryKind(kind: string): boolean {
  return kind === "countryCodes";
}

/**
 * Field-config target whose `options` mirror each string lookup kind — used both
 * when Setup persists a list and when validation overlays the live list.
 */
export const CONTACT_LOOKUP_FIELD_TARGETS = {
  genders: { tabId: "basic", fieldId: "gender" },
  socialPlatforms: { tabId: "socials", fieldId: "platform" },
  relationships: { tabId: "relationship", fieldId: "relationship" },
  phoneLabels: { tabId: "phones", fieldId: "label" },
  emailLabels: { tabId: "emails", fieldId: "label" },
  addressLabels: { tabId: "addresses", fieldId: "label" },
  educationDegrees: { tabId: "education", fieldId: "degree" },
  employmentTypes: { tabId: "experience", fieldId: "employmentType" },
  skillCategories: { tabId: "skills", fieldId: "category" },
  skillProficiencies: { tabId: "skills", fieldId: "proficiency" },
  bankNames: { tabId: "bankDetails", fieldId: "bankName" },
  tags: { tabId: "basic", fieldId: "tag" },
} as const satisfies Record<
  Exclude<ContactLookupKind, "countryCodes">,
  { tabId: string; fieldId: string }
>;

export type ContactLookupStringKind = keyof typeof CONTACT_LOOKUP_FIELD_TARGETS;

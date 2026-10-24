import { CONTACT_SYNC_FIELD_LABEL_KEYS, type AppTranslationKey } from "@mms/shared";

/** Maps stored English option values → i18n keys (EditableSelect / detail display). */
const CONTACT_OPTION_LABEL_KEYS: Record<string, AppTranslationKey> = {
  male: "contacts.gender.male",
  female: "contacts.gender.female",
  other: "contacts.gender.other",
  unspecified: "contacts.gender.unspecified",
  Mobile: "contacts.options.phone.mobile",
  Home: "contacts.options.address.home",
  Work: "contacts.options.phone.work",
  WhatsApp: "contacts.options.phone.whatsapp",
  Other: "contacts.options.phone.other",
  Personal: "contacts.options.email.personal",
  Billing: "contacts.options.address.billing",
  Facebook: "contacts.options.social.facebook",
  "Twitter / X": "contacts.options.social.x",
  Instagram: "contacts.options.social.instagram",
  LinkedIn: "contacts.options.social.linkedin",
  TikTok: "contacts.options.social.tiktok",
  YouTube: "contacts.options.social.youtube",
  Telegram: "contacts.options.social.telegram",
  Snapchat: "contacts.options.social.snapchat",
  Father: "contacts.options.relationship.father",
  Mother: "contacts.options.relationship.mother",
  Parent: "contacts.options.relationship.parent",
  Son: "contacts.options.relationship.son",
  Daughter: "contacts.options.relationship.daughter",
  Child: "contacts.options.relationship.child",
  Brother: "contacts.options.relationship.brother",
  Sister: "contacts.options.relationship.sister",
  Sibling: "contacts.options.relationship.sibling",
  Grandfather: "contacts.options.relationship.grandfather",
  Grandmother: "contacts.options.relationship.grandmother",
  Grandparent: "contacts.options.relationship.grandparent",
  Grandson: "contacts.options.relationship.grandson",
  Granddaughter: "contacts.options.relationship.granddaughter",
  Grandchild: "contacts.options.relationship.grandchild",
  Uncle: "contacts.options.relationship.uncle",
  Aunt: "contacts.options.relationship.aunt",
  "Aunt/Uncle": "contacts.options.relationship.auntUncle",
  Nephew: "contacts.options.relationship.nephew",
  Niece: "contacts.options.relationship.niece",
  "Niece/Nephew": "contacts.options.relationship.nieceNephew",
  Cousin: "contacts.options.relationship.cousin",
  "Father-In-Law": "contacts.options.relationship.fatherInLaw",
  "Mother-In-Law": "contacts.options.relationship.motherInLaw",
  "Parent-In-Law": "contacts.options.relationship.parentInLaw",
  "Son-In-Law": "contacts.options.relationship.sonInLaw",
  "Daughter-In-Law": "contacts.options.relationship.daughterInLaw",
  "Child-In-Law": "contacts.options.relationship.childInLaw",
  "Brother-In-Law": "contacts.options.relationship.brotherInLaw",
  "Sister-In-Law": "contacts.options.relationship.sisterInLaw",
  "Sibling-In-Law": "contacts.options.relationship.siblingInLaw",
  Guardian: "contacts.options.relationship.guardian",
  Dependent: "contacts.options.relationship.dependent",
  Spouse: "contacts.options.relationship.spouse",
  Husband: "contacts.options.relationship.husband",
  Wife: "contacts.options.relationship.wife",
  Friend: "contacts.options.relationship.friend",
  Colleague: "contacts.options.relationship.colleague",
};

/** Localizes a known contact option value; returns the raw value for custom options. */
export function formatContactOptionLabel(
  option: string | undefined | null,
  t: (key: AppTranslationKey) => string,
): string {
  if (!option) return "";
  const key = CONTACT_OPTION_LABEL_KEYS[option];
  return key ? t(key) : option;
}

/** Resolves localized or config-driven label for a phone entry with default fallbacks. */
export function resolvePhoneLabel(
  label: string | undefined | null,
  phoneLabels: string[] | undefined,
  t: (key: AppTranslationKey) => string,
): string {
  const raw = label || phoneLabels?.[0] || "";
  return formatContactOptionLabel(raw, t) || t("contacts.detail.mobileLabel");
}

/** Resolves localized or config-driven label for an email entry with default fallbacks. */
export function resolveEmailLabel(
  label: string | undefined | null,
  emailLabels: string[] | undefined,
  t: (key: AppTranslationKey) => string,
): string {
  const raw = label || emailLabels?.[0] || "";
  return formatContactOptionLabel(raw, t) || t("contacts.detail.personalLabel");
}

/** Resolves localized or config-driven label for an address entry with default fallbacks. */
export function resolveAddressLabel(
  label: string | undefined | null,
  addressLabels: string[] | undefined,
  t: (key: AppTranslationKey) => string,
): string {
  const raw = label || addressLabels?.[0] || "";
  return formatContactOptionLabel(raw, t) || t("contacts.detail.homeLabel");
}

/** Resolves localized or config-driven platform label for a social link entry with default fallbacks. */
export function resolveSocialPlatformLabel(
  platform: string | undefined | null,
  socialPlatforms: string[] | undefined,
  t: (key: AppTranslationKey) => string,
): string {
  const raw = platform || socialPlatforms?.[0] || "";
  return formatContactOptionLabel(raw, t) || t("contacts.detail.socialFallback");
}

/** Resolves a registry entry label via labelKey when present (custom entries keep English label). */
export function resolveRegistryLabel(
  entry: { label: string; labelKey?: AppTranslationKey | string },
  t: (key: AppTranslationKey) => string,
): string {
  if (entry.labelKey) {
    return t(entry.labelKey as AppTranslationKey);
  }
  return entry.label;
}

/** Resolves a registry field description via descriptionKey when present. */
export function resolveRegistryDescription(
  entry: { description?: string; descriptionKey?: AppTranslationKey | string },
  t: (key: AppTranslationKey) => string,
): string {
  if (entry.descriptionKey) {
    return t(entry.descriptionKey as AppTranslationKey);
  }
  return entry.description || "";
}

/** Resolves localized label for sync conflict fields based on single-source CONTACT_SYNC_FIELD_LABEL_KEYS. */
export function resolveSyncFieldLabel(
  field: string,
  t: (key: AppTranslationKey) => string,
): string {
  const key = CONTACT_SYNC_FIELD_LABEL_KEYS[field as keyof typeof CONTACT_SYNC_FIELD_LABEL_KEYS];
  return key ? t(key as AppTranslationKey) : field;
}

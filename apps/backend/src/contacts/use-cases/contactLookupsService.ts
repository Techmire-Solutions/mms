import {
  CONTACT_LOOKUP_KINDS,
  COUNTRY_CODES,
  DEFAULT_ADDRESS_LABELS,
  DEFAULT_BANK_NAMES,
  DEFAULT_EDUCATION_DEGREE_LABELS,
  DEFAULT_EMAIL_LABELS,
  DEFAULT_EMPLOYMENT_TYPE_LABELS,
  DEFAULT_PHONE_LABELS,
  DEFAULT_SKILL_CATEGORY_LABELS,
  DEFAULT_SKILL_PROFICIENCY_LABELS,
  DEFAULT_TAG_LABELS,
  GENDERS,
  RELATIONSHIPS,
  SOCIAL_PLATFORMS,
  curatedContactCountryCodes,
  isContactLookupCountryKind,
  needsContactCountryCodesCurate,
  type ContactLookupCountryCode,
  type ContactLookupKind,
  type ContactLookupsMap,
} from "@mms/shared";
import { createModuleStringListLookupsService } from "../../lib/createModuleStringListLookupsService.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { slugifyLookupLabel } from "../../lib/slugifyLookupLabel.js";
import {
  listContactLookupsByKind,
  listContactLookupsByWorkspace,
  replaceContactLookupsForKind,
} from "../../db/repositories/contactLookupsRepository.js";
import { broadcastCollection } from "../../lib/livePush.js";

type ContactStringLookupKind = Exclude<ContactLookupKind, "countryCodes">;

const CONTACT_STRING_LOOKUP_KINDS = CONTACT_LOOKUP_KINDS.filter(
  (kind): kind is ContactStringLookupKind => kind !== "countryCodes",
);

function defaultStringItems(kind: ContactStringLookupKind): string[] {
  switch (kind) {
    case "genders":
      return [...GENDERS];
    case "socialPlatforms":
      return [...SOCIAL_PLATFORMS];
    case "relationships":
      return [...RELATIONSHIPS];
    case "phoneLabels":
      return [...DEFAULT_PHONE_LABELS];
    case "emailLabels":
      return [...DEFAULT_EMAIL_LABELS];
    case "addressLabels":
      return [...DEFAULT_ADDRESS_LABELS];
    case "educationDegrees":
      return [...DEFAULT_EDUCATION_DEGREE_LABELS];
    case "employmentTypes":
      return [...DEFAULT_EMPLOYMENT_TYPE_LABELS];
    case "skillCategories":
      return [...DEFAULT_SKILL_CATEGORY_LABELS];
    case "skillProficiencies":
      return [...DEFAULT_SKILL_PROFICIENCY_LABELS];
    case "bankNames":
      return [...DEFAULT_BANK_NAMES];
    case "tags":
      return [...DEFAULT_TAG_LABELS];
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function defaultCountryItems(): ContactLookupCountryCode[] {
  return COUNTRY_CODES.map((entry) => ({ ...entry }));
}

function emptyStringLookupsMap(): Record<ContactStringLookupKind, string[]> {
  return {
    genders: defaultStringItems("genders"),
    socialPlatforms: defaultStringItems("socialPlatforms"),
    relationships: defaultStringItems("relationships"),
    phoneLabels: defaultStringItems("phoneLabels"),
    emailLabels: defaultStringItems("emailLabels"),
    addressLabels: defaultStringItems("addressLabels"),
    educationDegrees: defaultStringItems("educationDegrees"),
    employmentTypes: defaultStringItems("employmentTypes"),
    skillCategories: defaultStringItems("skillCategories"),
    skillProficiencies: defaultStringItems("skillProficiencies"),
    bankNames: defaultStringItems("bankNames"),
    tags: defaultStringItems("tags"),
  };
}

function rowsToCountryItems(
  rows: Array<{ label: string; meta: Record<string, unknown> | null }>,
): ContactLookupCountryCode[] {
  const items: ContactLookupCountryCode[] = [];
  for (const row of rows) {
    const code = row.meta && typeof row.meta.code === "string" ? row.meta.code.trim() : "";
    if (row.label && code) items.push({ country: row.label, code });
  }
  return items;
}

const stringListLookups = createModuleStringListLookupsService<
  ContactStringLookupKind,
  Record<ContactStringLookupKind, string[]>
>({
  kinds: CONTACT_STRING_LOOKUP_KINDS,
  emptyMap: emptyStringLookupsMap,
  defaultItems: defaultStringItems,
  listByWorkspace: listContactLookupsByWorkspace,
  listByKind: listContactLookupsByKind,
  replaceForKind: replaceContactLookupsForKind,
  broadcastKey: "contacts",
});

async function loadCountryCodes(tenant = getRequestTenant()): Promise<ContactLookupCountryCode[]> {
  if (!tenant) return defaultCountryItems();
  const rows = await listContactLookupsByKind(tenant, "countryCodes");
  if (!rows || rows.length === 0) return defaultCountryItems();
  const countries = rowsToCountryItems(rows);
  return needsContactCountryCodesCurate(countries) ? curatedContactCountryCodes() : countries;
}

export async function loadContactLookupsMap(
  tenant = getRequestTenant(),
): Promise<ContactLookupsMap> {
  const strings = await stringListLookups.loadMap(tenant);
  return {
    ...strings,
    countryCodes: await loadCountryCodes(tenant),
  };
}

export async function loadContactLookupKind(
  kind: ContactLookupKind,
  tenant = getRequestTenant(),
): Promise<string[] | ContactLookupCountryCode[]> {
  if (kind === "countryCodes") return loadCountryCodes(tenant);
  return stringListLookups.loadKind(kind, tenant);
}

export async function replaceContactLookupKind(
  kind: ContactLookupKind,
  items: string[] | ContactLookupCountryCode[],
  tenant = getRequestTenant(),
): Promise<string[] | ContactLookupCountryCode[]> {
  if (!tenant) throw new Error("Tenant context required");

  if (isContactLookupCountryKind(kind)) {
    const countries = (items as ContactLookupCountryCode[])
      .map((entry) => ({
        country: entry.country.trim(),
        code: entry.code.trim(),
      }))
      .filter((entry) => entry.country && entry.code);
    const curated = needsContactCountryCodesCurate(countries)
      ? curatedContactCountryCodes()
      : countries;
    await replaceContactLookupsForKind(
      tenant,
      kind,
      curated.map((entry, index) => ({
        id: `${tenant}:${kind}:${slugifyLookupLabel(entry.country, index)}`,
        kind,
        label: entry.country,
        meta: { code: entry.code },
        sortOrder: index,
      })),
    );
    await broadcastCollection("contacts");
    return curated;
  }

  return stringListLookups.replaceKind(kind as ContactStringLookupKind, items as string[], tenant);
}

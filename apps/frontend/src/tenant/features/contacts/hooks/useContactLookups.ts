import {
  CONTACTS_MODULE_MANIFEST,
  type ContactLookupKind,
  type ContactLookupCountryCode,
  type ContactLookupsMap,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { createModuleLookupsHooks } from "@/lib/query/createModuleLookupsHooks";
import { getContactConfigCollectionDefaults } from "@/lib/contacts/contactConfigSeeds";

export const CONTACTS_LOOKUPS_QUERY_KEY = [
  CONTACTS_MODULE_MANIFEST.collectionKey,
  "lookups",
] as const;

type ContactLookupItems = string[] | ContactLookupCountryCode[];

const defaults = (): ContactLookupsMap => {
  const seeded = getContactConfigCollectionDefaults();
  return {
    genders: seeded.genders,
    socialPlatforms: seeded.socialPlatforms,
    relationships: seeded.relationships,
    phoneLabels: seeded.phoneLabels,
    emailLabels: seeded.emailLabels,
    addressLabels: seeded.addressLabels,
    countryCodes: seeded.countryCodes,
    educationDegrees: seeded.educationDegrees,
    employmentTypes: seeded.employmentTypes,
    skillCategories: seeded.skillCategories,
    skillProficiencies: seeded.skillProficiencies,
    bankNames: seeded.bankNames,
    tags: seeded.tags,
  };
};

export async function fetchContactLookups(signal?: AbortSignal): Promise<ContactLookupsMap> {
  const response = await apiContract.contacts.getLookups({
    query: {},
    fetchOptions: { signal },
    signal,
  });
  if (response.status !== 200) return defaults();
  const body = response.body as { lookups?: ContactLookupsMap } | undefined;
  return body?.lookups ?? defaults();
}

async function putContactLookupKind(
  kind: ContactLookupKind,
  items: ContactLookupItems,
): Promise<ContactLookupItems> {
  const response = await apiContract.contacts.updateLookups({
    params: { kind },
    body: { items },
  });
  if (response.status !== 200) throw new Error("Failed to update contact lookups");
  const body = response.body as { items?: ContactLookupItems } | undefined;
  return body?.items ?? items;
}

const lookupsHooks = createModuleLookupsHooks<
  ContactLookupsMap,
  ContactLookupKind,
  ContactLookupItems
>({
  queryKey: CONTACTS_LOOKUPS_QUERY_KEY,
  fetchLookups: fetchContactLookups,
  putLookupKind: putContactLookupKind,
  defaults,
});

export const useContactLookupsQuery = lookupsHooks.useLookupsQuery;
export const useContactLookupMutation = lookupsHooks.useLookupMutation;

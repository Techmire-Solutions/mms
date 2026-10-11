/**
 * ContactConfigContext
 * Broadcasts contact field configuration and preferences via TanStack Query + REST
 * (`/api/contacts/field-config`, preferences, lookups, column-prefs).
 * Mount once under TenantScopedProviders — never nest on child pages.
 *
 * The provider delegates the shared settings slice to `createStandardModuleConfigHook`
 * (same skeleton as Teachers/Students/Sessions/Users/Enrollments) and layers the
 * Contacts-specific lookups / column-layout / tab-fields / prefs on top.
 *
 * Usage:
 *   const { settings, updateSettings } = useContactConfig();
 *   const columns = useContactColumns();         // dynamic table columns
 *   const schema  = useContactValidation();     // dynamic Zod-like validation
 */
import React, { type ReactNode, useContext } from "react";
import {
  ContactConfigContext,
  type ContactConfigContextType,
  type ContactsColumnConfig,
} from "@/lib/contacts/contactConfigContextTypes";
import {
  useContactPreferencesQuery,
  useContactPreferencesMutation,
} from "@/tenant/features/contacts/hooks/useContactSetupConfig";
import {
  useContactLookupsQuery,
  useContactLookupMutation,
} from "@/tenant/features/contacts/hooks/useContactLookups";
import {
  useContactsContractFieldConfig,
  useContactsContractUpdateFieldConfig,
} from "@/tenant/features/contacts/hooks/useContactsTsrHooks";
import {
  DEFAULT_CONTACT_PREFERENCES,
  type ContactPreferences,
  type FieldConfig,
} from "@mms/shared";
import { useContactConfigProviderValue } from "@/lib/contacts/useContactConfigProviderValue";
import { reportClientError } from "@/lib/clientErrorReporting";
import { useAuth } from "@/lib/contexts/AuthContext";
import { getDefaultContactConfigContextValue } from "@/lib/contacts/defaultContactConfigValue";

export { ContactConfigContext };
export type { ContactConfigContextType, ContactsColumnConfig };

/**
 * Context Provider that loads contact configuration from typed Contacts Setup REST
 * (Query-backed). Invalidation refreshes consumers — not a localStorage / live DB cache.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child elements.
 * @returns {React.JSX.Element}
 */
export function ContactConfigProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { data: prefsData } = useContactPreferencesQuery();
  const { mutateAsync: updatePrefsAsync } = useContactPreferencesMutation();
  const updatePrefs = (newPrefs: Partial<ContactPreferences>) => {
    const fullPrefs: ContactPreferences = {
      ...(prefsData || DEFAULT_CONTACT_PREFERENCES),
      ...newPrefs,
    };
    updatePrefsAsync(fullPrefs).catch((error) =>
      reportClientError(error, { context: "contacts.updatePrefs" }),
    );
  };

  const {
    data: lookupsData,
    isLoading: lookupsLoading,
    error: lookupsError,
  } = useContactLookupsQuery();
  const { mutateAsync: updateLookupKind } = useContactLookupMutation();

  const { data: fieldConfigResponse } = useContactsContractFieldConfig(isAuthenticated);
  const { mutateAsync: updateFieldConfig } = useContactsContractUpdateFieldConfig();

  const updateConfigAsync = async (nextConfig: FieldConfig) => {
    await updateFieldConfig({ body: nextConfig });
  };
  const updateConfig = (nextConfig: FieldConfig) => {
    updateConfigAsync(nextConfig).catch((error) =>
      reportClientError(error, { context: "contacts.updateConfig" }),
    );
  };

  const config = {
    prefs: prefsData,
    lookupsLoading,
    lookupsError,
    genders: lookupsData?.genders,
    socialPlatforms: lookupsData?.socialPlatforms,
    relationships: lookupsData?.relationships,
    phoneLabels: lookupsData?.phoneLabels,
    emailLabels: lookupsData?.emailLabels,
    addressLabels: lookupsData?.addressLabels,
    countryCodes: lookupsData?.countryCodes,
    educationDegrees: lookupsData?.educationDegrees,
    employmentTypes: lookupsData?.employmentTypes,
    skillCategories: lookupsData?.skillCategories,
    skillProficiencies: lookupsData?.skillProficiencies,
    bankNames: lookupsData?.bankNames,
    tags: lookupsData?.tags,
    updatePrefs,
    updatePrefsAsync,
    updateGenders: (genders: string[]) => updateLookupKind({ kind: "genders", items: genders }),
    updateSocialPlatforms: (socialPlatforms: string[]) =>
      updateLookupKind({ kind: "socialPlatforms", items: socialPlatforms }),
    updateRelationships: (relationships: string[]) =>
      updateLookupKind({ kind: "relationships", items: relationships }),
    updatePhoneLabels: (phoneLabels: string[]) =>
      updateLookupKind({ kind: "phoneLabels", items: phoneLabels }),
    updateEmailLabels: (emailLabels: string[]) =>
      updateLookupKind({ kind: "emailLabels", items: emailLabels }),
    updateAddressLabels: (addressLabels: string[]) =>
      updateLookupKind({ kind: "addressLabels", items: addressLabels }),
    updateCountryCodes: (countryCodes: Array<{ country: string; code: string }>) =>
      updateLookupKind({ kind: "countryCodes", items: countryCodes }),
    updateEducationDegrees: (educationDegrees: string[]) =>
      updateLookupKind({ kind: "educationDegrees", items: educationDegrees }),
    updateEmploymentTypes: (employmentTypes: string[]) =>
      updateLookupKind({ kind: "employmentTypes", items: employmentTypes }),
    updateSkillCategories: (skillCategories: string[]) =>
      updateLookupKind({ kind: "skillCategories", items: skillCategories }),
    updateSkillProficiencies: (skillProficiencies: string[]) =>
      updateLookupKind({ kind: "skillProficiencies", items: skillProficiencies }),
    updateBankNames: (bankNames: string[]) =>
      updateLookupKind({ kind: "bankNames", items: bankNames }),
    updateTags: (tags: string[]) => updateLookupKind({ kind: "tags", items: tags }),
    ...(fieldConfigResponse?.body ?? {}),
    updateConfig,
    updateConfigAsync,
  };

  const value: ContactConfigContextType = useContactConfigProviderValue(config);

  return <ContactConfigContext value={value}>{children}</ContactConfigContext>;
}

/**
 * Hook to consume the ContactConfigContext.
 *
 * @returns {ContactConfigContextType} The configuration context value.
 */
export function useContactConfig(): ContactConfigContextType {
  const contactConfig = useContext(ContactConfigContext);
  return contactConfig ?? getDefaultContactConfigContextValue();
}

// ── Dynamic column builder hook ───────────────────────────────────────────────
/**
 * Returns the ordered list of table columns that should be visible,
 * derived entirely from the current configuration.
 *
 * @returns {ContactsColumnConfig[]} The array of active column descriptors.
 */
export function useContactColumns(): ContactsColumnConfig[] {
  return useContactConfig().visibleColumns;
}

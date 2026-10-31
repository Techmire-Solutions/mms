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
import React, { useCallback, useMemo, useRef, type ReactNode, useContext } from "react";
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
} from "@/tenant/features/contacts/hooks/useContactsQueries";
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

  const updatePrefsAsyncRef = useRef(updatePrefsAsync);
  updatePrefsAsyncRef.current = updatePrefsAsync;

  const prefsDataRef = useRef(prefsData);
  prefsDataRef.current = prefsData;

  const updatePrefs = useCallback((newPrefs: Partial<ContactPreferences>) => {
    const fullPrefs: ContactPreferences = {
      ...(prefsDataRef.current || DEFAULT_CONTACT_PREFERENCES),
      ...newPrefs,
    };
    updatePrefsAsyncRef
      .current(fullPrefs)
      .catch((error) => reportClientError(error, { context: "contacts.updatePrefs" }));
  }, []);

  const stableUpdatePrefsAsync = useCallback(
    (newPrefs: ContactPreferences) => updatePrefsAsyncRef.current(newPrefs),
    [],
  );

  const {
    data: lookupsData,
    isLoading: lookupsLoading,
    error: lookupsError,
  } = useContactLookupsQuery();
  const { mutateAsync: updateLookupKind } = useContactLookupMutation();

  const updateLookupKindRef = useRef(updateLookupKind);
  updateLookupKindRef.current = updateLookupKind;

  const { data: fieldConfigResponse } = useContactsContractFieldConfig(isAuthenticated);
  const { mutateAsync: updateFieldConfig } = useContactsContractUpdateFieldConfig();

  const updateFieldConfigRef = useRef(updateFieldConfig);
  updateFieldConfigRef.current = updateFieldConfig;

  const updateConfigAsync = useCallback(async (nextConfig: FieldConfig) => {
    await updateFieldConfigRef.current({ body: nextConfig });
  }, []);

  const updateConfig = useCallback(
    (nextConfig: FieldConfig) => {
      updateConfigAsync(nextConfig).catch((error) =>
        reportClientError(error, { context: "contacts.updateConfig" }),
      );
    },
    [updateConfigAsync],
  );

  const updateGenders = useCallback(
    (genders: string[]) => updateLookupKindRef.current({ kind: "genders", items: genders }),
    [],
  );
  const updateSocialPlatforms = useCallback(
    (socialPlatforms: string[]) =>
      updateLookupKindRef.current({ kind: "socialPlatforms", items: socialPlatforms }),
    [],
  );
  const updateRelationships = useCallback(
    (relationships: string[]) =>
      updateLookupKindRef.current({ kind: "relationships", items: relationships }),
    [],
  );
  const updatePhoneLabels = useCallback(
    (phoneLabels: string[]) =>
      updateLookupKindRef.current({ kind: "phoneLabels", items: phoneLabels }),
    [],
  );
  const updateEmailLabels = useCallback(
    (emailLabels: string[]) =>
      updateLookupKindRef.current({ kind: "emailLabels", items: emailLabels }),
    [],
  );
  const updateAddressLabels = useCallback(
    (addressLabels: string[]) =>
      updateLookupKindRef.current({ kind: "addressLabels", items: addressLabels }),
    [],
  );
  const updateCountryCodes = useCallback(
    (countryCodes: Array<{ country: string; code: string }>) =>
      updateLookupKindRef.current({ kind: "countryCodes", items: countryCodes }),
    [],
  );
  const updateEducationDegrees = useCallback(
    (educationDegrees: string[]) =>
      updateLookupKindRef.current({ kind: "educationDegrees", items: educationDegrees }),
    [],
  );
  const updateEmploymentTypes = useCallback(
    (employmentTypes: string[]) =>
      updateLookupKindRef.current({ kind: "employmentTypes", items: employmentTypes }),
    [],
  );
  const updateSkillCategories = useCallback(
    (skillCategories: string[]) =>
      updateLookupKindRef.current({ kind: "skillCategories", items: skillCategories }),
    [],
  );
  const updateSkillProficiencies = useCallback(
    (skillProficiencies: string[]) =>
      updateLookupKindRef.current({ kind: "skillProficiencies", items: skillProficiencies }),
    [],
  );
  const updateBankNames = useCallback(
    (bankNames: string[]) => updateLookupKindRef.current({ kind: "bankNames", items: bankNames }),
    [],
  );
  const updateTags = useCallback(
    (tags: string[]) => updateLookupKindRef.current({ kind: "tags", items: tags }),
    [],
  );

  const fieldConfigBody = fieldConfigResponse?.body;

  const config = useMemo(
    () => ({
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
      updatePrefsAsync: stableUpdatePrefsAsync,
      updateGenders,
      updateSocialPlatforms,
      updateRelationships,
      updatePhoneLabels,
      updateEmailLabels,
      updateAddressLabels,
      updateCountryCodes,
      updateEducationDegrees,
      updateEmploymentTypes,
      updateSkillCategories,
      updateSkillProficiencies,
      updateBankNames,
      updateTags,
      ...(fieldConfigBody ?? {}),
      updateConfig,
      updateConfigAsync,
    }),
    [
      prefsData,
      lookupsLoading,
      lookupsError,
      lookupsData?.genders,
      lookupsData?.socialPlatforms,
      lookupsData?.relationships,
      lookupsData?.phoneLabels,
      lookupsData?.emailLabels,
      lookupsData?.addressLabels,
      lookupsData?.countryCodes,
      lookupsData?.educationDegrees,
      lookupsData?.employmentTypes,
      lookupsData?.skillCategories,
      lookupsData?.skillProficiencies,
      lookupsData?.bankNames,
      lookupsData?.tags,
      updatePrefs,
      stableUpdatePrefsAsync,
      updateGenders,
      updateSocialPlatforms,
      updateRelationships,
      updatePhoneLabels,
      updateEmailLabels,
      updateAddressLabels,
      updateCountryCodes,
      updateEducationDegrees,
      updateEmploymentTypes,
      updateSkillCategories,
      updateSkillProficiencies,
      updateBankNames,
      updateTags,
      fieldConfigBody,
      updateConfig,
      updateConfigAsync,
    ],
  );

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

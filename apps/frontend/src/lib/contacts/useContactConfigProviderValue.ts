import React from "react";
import {
  applyRelationshipOptionOrder,
  deriveRelationshipOptionsFromPairs,
  resolveRelationshipPairs,
  normalizeContactPreferences,
  INITIAL_FIELD_SEED,
  resolveContactEnabledTabIds,
  type FieldDefinition,
} from "@mms/shared";
import type { ContactConfigContextType } from "@/lib/contacts/contactConfigContextTypes";
import type { ContactConfigExtras } from "@/lib/contacts/useContactConfigTypes";
import { getFallbackCountryCode } from "@/lib/contacts/contactI18n";
import { useContactConfigColumnLayout } from "@/lib/contacts/useContactConfigColumnLayout";

type ContactConfigProviderInput = Partial<ContactConfigExtras> & {
  enabledTabs?: string[];
  requiredTabs?: string[];
};

const EMPTY_ARRAY: never[] = [];
const EMPTY_OBJECT: Record<string, never> = {};

/**
 * Builds ContactConfig context value.
 * Relationship-type options are derived from the fixed system pair catalog
 * (`resolveRelationshipPairs` → Parent/Child, Husband/Wife, Guardian/Dependent).
 * Lookups kind `relationships` remains a write mirror only.
 */
export function useContactConfigProviderValue(
  config: ContactConfigProviderInput,
): ContactConfigContextType {
  const {
    prefs: rawPrefs,
    updateConfig = () => {},
    updateConfigAsync = async () => {},
    updatePrefs = () => {},
    updatePrefsAsync = async () => {},
    genders = EMPTY_ARRAY,
    socialPlatforms = EMPTY_ARRAY,
    phoneLabels = EMPTY_ARRAY,
    emailLabels = EMPTY_ARRAY,
    addressLabels = EMPTY_ARRAY,
    countryCodes = EMPTY_ARRAY,
    countryCodesMap = EMPTY_OBJECT,
    educationDegrees = EMPTY_ARRAY,
    employmentTypes = EMPTY_ARRAY,
    skillCategories = EMPTY_ARRAY,
    skillProficiencies = EMPTY_ARRAY,
    bankNames = EMPTY_ARRAY,
    tags = EMPTY_ARRAY,
    lookupsLoading = false,
    lookupsError = null,
    updateGenders = () => {},
    updateSocialPlatforms = () => {},
    updateRelationships = () => {},
    updatePhoneLabels = () => {},
    updateEmailLabels = () => {},
    updateAddressLabels = () => {},
    updateEducationDegrees = () => {},
    updateEmploymentTypes = () => {},
    updateSkillCategories = () => {},
    updateSkillProficiencies = () => {},
    updateBankNames = () => {},
    updateTags = () => {},
    updateCountryCodes = () => {},
    systemSortOptions = EMPTY_ARRAY,
    fields = EMPTY_OBJECT,
    formTabs = EMPTY_ARRAY,
    enabledTabs = EMPTY_ARRAY,
    requiredTabs = ["basic"],
  } = config || {};

  const resolvedFields = React.useMemo(() => {
    if (!fields || Object.keys(fields).length === 0) {
      return INITIAL_FIELD_SEED;
    }
    return fields;
  }, [fields]);

  const prefs = React.useMemo(() => normalizeContactPreferences(rawPrefs), [rawPrefs]);

  const {
    syncedColumnRegistry,
    availableColumns,
    visibleColumns,
    updateUserColumnLayout,
    getColumnWidth,
    setColumnWidth,
    isColumnVisible,
  } = useContactConfigColumnLayout({
    baseColumnRegistry: config?.columnRegistry,
    resolvedFields,
    enabledTabs,
  });

  const defaultPhoneCountryCode = React.useMemo(
    () => getFallbackCountryCode(prefs, countryCodesMap, countryCodes),
    [prefs, countryCodesMap, countryCodes],
  );

  /** Form Relationship-type dropdown — fixed system catalog (Parent/Child, …). */
  const resolvedRelationships = React.useMemo(() => {
    const derived = deriveRelationshipOptionsFromPairs(
      resolveRelationshipPairs(prefs?.relationshipPairs),
    );
    return applyRelationshipOptionOrder(derived, prefs?.relationshipOptionOrder);
  }, [prefs?.relationshipPairs, prefs?.relationshipOptionOrder]);

  return React.useMemo(
    () => ({
      formTabsReady: true,
      enabledTabIds: resolveContactEnabledTabIds({ formTabs, enabledTabs }, "admin"),
      requiredTabIds: new Set(requiredTabs),
      fields: resolvedFields,
      formTabs,
      isTabFieldEnabled: (tabId: string, fieldId: string) => {
        const tabFields = resolvedFields?.[tabId];
        if (!tabFields) return true;
        const field = tabFields.find((f: FieldDefinition) => f.key === fieldId);
        return field?.enabled ?? true;
      },
      isTabFieldRequired: (tabId: string, fieldId: string) => {
        const tabFields = resolvedFields?.[tabId];
        if (!tabFields) return false;
        const field = tabFields.find((f: FieldDefinition) => f.key === fieldId);
        return field?.required ?? false;
      },
      prefs,
      updateConfig,
      updateConfigAsync,
      updatePrefs,
      updatePrefsAsync,
      genders,
      socialPlatforms,
      relationships: resolvedRelationships,
      phoneLabels,
      emailLabels,
      addressLabels,
      countryCodes,
      countryCodesMap,
      educationDegrees,
      employmentTypes,
      skillCategories,
      skillProficiencies,
      bankNames,
      tags,
      lookupsLoading,
      lookupsError,
      defaultPhoneCountryCode,
      columnRegistry: syncedColumnRegistry,
      availableColumns,
      visibleColumns,
      updateGenders,
      updateSocialPlatforms,
      updateRelationships,
      updatePhoneLabels,
      updateEmailLabels,
      updateAddressLabels,
      updateEducationDegrees,
      updateEmploymentTypes,
      updateSkillCategories,
      updateSkillProficiencies,
      updateBankNames,
      updateTags,
      updateCountryCodes,
      updateUserColumnLayout,
      isColumnVisible,
      getColumnWidth,
      setColumnWidth,
      systemSortOptions,
    }),
    [
      enabledTabs,
      requiredTabs,
      resolvedFields,
      formTabs,
      prefs,
      updateConfig,
      updateConfigAsync,
      updatePrefs,
      updatePrefsAsync,
      genders,
      socialPlatforms,
      resolvedRelationships,
      phoneLabels,
      emailLabels,
      addressLabels,
      countryCodes,
      countryCodesMap,
      educationDegrees,
      employmentTypes,
      skillCategories,
      skillProficiencies,
      bankNames,
      tags,
      lookupsLoading,
      lookupsError,
      defaultPhoneCountryCode,
      syncedColumnRegistry,
      availableColumns,
      visibleColumns,
      updateGenders,
      updateSocialPlatforms,
      updateRelationships,
      updatePhoneLabels,
      updateEmailLabels,
      updateAddressLabels,
      updateEducationDegrees,
      updateEmploymentTypes,
      updateSkillCategories,
      updateSkillProficiencies,
      updateBankNames,
      updateTags,
      updateCountryCodes,
      updateUserColumnLayout,
      isColumnVisible,
      getColumnWidth,
      setColumnWidth,
      systemSortOptions,
    ],
  );
}

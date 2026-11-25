import { useContactConfig } from "@mms/mod-contacts/frontend/tenant/components/ContactConfigContext";
import { useContactFormDraftOptions } from "./useContactFormDraftOptions.js";

export function useContactFormLookups(defaultCountry: string) {
  const config = useContactConfig();
  const defaultCountryCode = config.defaultPhoneCountryCode;

  const options = useContactFormDraftOptions({
    phoneLabels: config.phoneLabels,
    emailLabels: config.emailLabels,
    addressLabels: config.addressLabels,
    socialPlatforms: config.socialPlatforms,
    relationshipOptions: config.relationships,
    educationDegrees: config.educationDegrees,
    employmentTypes: config.employmentTypes,
    skillCategories: config.skillCategories,
    skillProficiencies: config.skillProficiencies,
    defaultCountryCode,
    countryCodes: config.countryCodes,
    defaultCountry,
    updateCountryCodes: config.updateCountryCodes,
  });

  return {
    config,
    defaultCountryCode,
    ...options,
  };
}

import { useCallback, useMemo } from "react";
import {
  mergeCountryDialCodeOptions,
  mergeCountryNameOptions,
  normalizeDialCode,
  type CountryCodeEntry,
} from "@/lib/contacts/countryCodeOptions";
import { buildOptionDefaults } from "@/tenant/features/contacts/hooks/contactFormDraftUtils";

export function useContactFormDraftOptions({
  phoneLabels,
  emailLabels,
  addressLabels,
  socialPlatforms,
  relationshipOptions,
  educationDegrees,
  employmentTypes,
  skillCategories,
  skillProficiencies,
  defaultCountryCode,
  countryCodes,
  defaultCountry,
  updateCountryCodes,
}: {
  phoneLabels: string[];
  emailLabels: string[];
  addressLabels: string[];
  socialPlatforms: string[];
  relationshipOptions: string[];
  educationDegrees?: string[];
  employmentTypes?: string[];
  skillCategories?: string[];
  skillProficiencies?: string[];
  defaultCountryCode: string;
  countryCodes: CountryCodeEntry[];
  defaultCountry: string;
  updateCountryCodes: (next: CountryCodeEntry[]) => void;
}) {
  const optionDefaults = useMemo(
    () =>
      buildOptionDefaults({
        phoneLabels,
        emailLabels,
        addressLabels,
        socialPlatforms,
        relationshipOptions,
        educationDegrees,
        employmentTypes,
        skillCategories,
        skillProficiencies,
        defaultPhoneCountryCode: defaultCountryCode,
      }),
    [
      phoneLabels,
      emailLabels,
      addressLabels,
      socialPlatforms,
      relationshipOptions,
      educationDegrees,
      employmentTypes,
      skillCategories,
      skillProficiencies,
      defaultCountryCode,
    ],
  );

  const countryCodeOptions = useMemo(() => {
    const list = (countryCodes || [])
      .map((countryItem) => normalizeDialCode(countryItem.code))
      .filter(Boolean);
    const fallback = normalizeDialCode(defaultCountryCode);
    return Array.from(new Set([fallback, ...list].filter(Boolean)));
  }, [countryCodes, defaultCountryCode]);

  const countryOptions = useMemo(() => {
    const names = (countryCodes || []).map((entry) => entry.country).filter(Boolean);
    return Array.from(new Set([defaultCountry, ...names].filter(Boolean)));
  }, [countryCodes, defaultCountry]);

  const updateCountryOptions = useCallback(
    (nextCountries: string[]) => {
      updateCountryCodes(mergeCountryNameOptions(countryCodes, nextCountries));
    },
    [countryCodes, updateCountryCodes],
  );

  const updateDialCodeOptions = useCallback(
    (nextCodes: string[]) => {
      updateCountryCodes(mergeCountryDialCodeOptions(countryCodes, nextCodes));
    },
    [countryCodes, updateCountryCodes],
  );

  return {
    optionDefaults,
    countryCodeOptions,
    countryOptions,
    updateCountryOptions,
    updateDialCodeOptions,
  };
}

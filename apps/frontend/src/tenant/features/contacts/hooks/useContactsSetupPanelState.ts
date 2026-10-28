import { useState } from "react";
import { type ContactPreferences } from "@mms/shared";
import type { CountryCodeEntry } from "@/lib/contacts/countryCodeOptions";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { useContactsPreferencesSave } from "@/tenant/features/contacts/hooks/useContactsPreferencesSave";

export function useContactsSetupPanelState() {
  const {
    updatePrefsAsync,
    prefs: contextPrefs,
    countryCodes,
    updateCountryCodes,
  } = useContactConfig();

  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState<ContactPreferences>(() => contextPrefs);
  const [countryCodesDraft, setCountryCodesDraft] = useState<CountryCodeEntry[]>(
    () => countryCodes,
  );

  const isPrefsDraftDirty = (() => JSON.stringify(prefs) !== JSON.stringify(contextPrefs))();

  const isCountryCodesDirty = (() =>
    JSON.stringify(countryCodesDraft) !== JSON.stringify(countryCodes))();

  const isPreferencesDirty = isPrefsDraftDirty || isCountryCodesDirty;

  const [prevContextPrefs, setPrevContextPrefs] = useState(contextPrefs);
  if (prevContextPrefs !== contextPrefs) {
    setPrevContextPrefs(contextPrefs);
    if (!isPreferencesDirty) {
      setPrefs(contextPrefs);
    }
  }

  const [prevCountryCodes, setPrevCountryCodes] = useState(countryCodes);
  if (prevCountryCodes !== countryCodes) {
    setPrevCountryCodes(countryCodes);
    if (!isPreferencesDirty) {
      setCountryCodesDraft(countryCodes);
    }
  }

  const updatePreference = <K extends keyof ContactPreferences>(
    key: K,
    value: ContactPreferences[K],
  ): void => {
    setPrefs((currentPreferences) => ({ ...currentPreferences, [key]: value }));
    setSaved(false);
  };

  const updateCountryCodesDraft = (next: CountryCodeEntry[]) => {
    setCountryCodesDraft(next);
    setSaved(false);
  };

  const { isSaving, handleSave } = useContactsPreferencesSave({
    contextPrefs,
    prefs,
    setPrefs,
    updatePrefsAsync,
    updateCountryCodes,
    countryCodesDraft,
    setCountryCodesDraft,
    setSaved,
  });

  return {
    prefs,
    saved,
    setSaved,
    isSaving,
    isPrefsDirty: isPreferencesDirty,
    countryCodes: countryCodesDraft,
    updateCountryCodes: updateCountryCodesDraft,
    updatePreference,
    handleSave,
  };
}

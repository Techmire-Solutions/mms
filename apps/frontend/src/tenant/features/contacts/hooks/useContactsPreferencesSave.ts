import { useState, type Dispatch, type SetStateAction } from "react";
import {
  type AppTranslationKey,
  type ContactPreferences,
  type ContactPreferencesSetupIssue,
  prepareContactPreferencesSetupSave,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactMutations } from "@/tenant/features/contacts/hooks/useContacts";
import { notify } from "@/lib/notify";
import { safeAudit } from "@/lib/safeAudit";
import type { CountryCodeEntry } from "@/lib/contacts/countryCodeOptions";

const PREFS_SETUP_ISSUE_KEYS: Record<ContactPreferencesSetupIssue, AppTranslationKey> = {
  invalidProvince: "contacts.setup.invalidProvince",
  invalidCity: "contacts.setup.invalidCity",
  invalidThresholdHigh: "contacts.setup.invalidThresholdHigh",
  invalidThresholdMedium: "contacts.setup.invalidThresholdMedium",
  thresholdOrder: "contacts.setup.thresholdOrder",
  emptyCountryRow: "contacts.setup.emptyCountryRow",
  invalidDialCode: "contacts.setup.invalidDialCode",
  duplicateCountry: "contacts.setup.duplicateCountry",
};

/**
 * Contacts Setup Preferences save: pre-validation + country-code draft commit
 * with prefs rollback on country-code failure. Kept bespoke because the shared
 * save hook cannot express the country-code two-step write.
 */
export function useContactsPreferencesSave({
  contextPrefs,
  prefs,
  setPrefs,
  updatePrefsAsync,
  updateCountryCodes,
  countryCodesDraft,
  setCountryCodesDraft,
  setSaved,
}: {
  contextPrefs: ContactPreferences;
  prefs: ContactPreferences;
  setPrefs: Dispatch<SetStateAction<ContactPreferences>>;
  updatePrefsAsync: (prefs: ContactPreferences) => Promise<void>;
  updateCountryCodes: (countryCodes: CountryCodeEntry[]) => void | Promise<void>;
  countryCodesDraft: CountryCodeEntry[];
  setCountryCodesDraft: Dispatch<SetStateAction<CountryCodeEntry[]>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
}) {
  const { t } = useTranslation();
  const { logSetupAudit } = useContactMutations();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (): Promise<void> => {
    const prepared = prepareContactPreferencesSetupSave(prefs, countryCodesDraft);
    if (!prepared.ok) {
      notify.error(t(PREFS_SETUP_ISSUE_KEYS[prepared.issue]));
      return;
    }

    setIsSaving(true);
    try {
      await updatePrefsAsync(prepared.prefs);
      try {
        await updateCountryCodes(prepared.countryCodes);
      } catch (countryError) {
        // Roll back prefs so Setup does not leave a partial Preferences write.
        await updatePrefsAsync(contextPrefs);
        throw countryError;
      }
      safeAudit(
        logSetupAudit.mutateAsync({
          area: "preferences",
          summary: t("contacts.setup.auditSummary", { area: "preferences" }),
        }),
        "contacts.setup_audit",
      );
      setPrefs(prepared.prefs);
      setCountryCodesDraft(prepared.countryCodes);
      notify.success(t("contacts.setup.preferencesSaved"));
      setSaved(true);
    } catch {
      setSaved(false);
      notify.error(t("contacts.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return { isSaving, handleSave };
}

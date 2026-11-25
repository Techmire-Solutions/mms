import type React from "react";
import type { ContactPreferences } from "@mms/contracts";
import { ContactsPreferencesGeneralSection } from "./ContactsPreferencesGeneralSection.js";
import { ContactsPreferencesDuplicateSection } from "./ContactsPreferencesDuplicateSection.js";

export interface ContactsPreferencesSectionProps {
  prefs: ContactPreferences;
  isPrefsDirty: boolean;
  onUpdatePreference: <K extends keyof ContactPreferences>(
    key: K,
    value: ContactPreferences[K],
  ) => void;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

/** Stable barrel — Setup Preferences sections for Contacts. */
export function ContactsPreferencesSection({
  prefs,
  isPrefsDirty,
  onUpdatePreference,
  saving,
  saved,
  onSave,
}: ContactsPreferencesSectionProps): React.JSX.Element {
  return (
    <>
      <ContactsPreferencesGeneralSection
        prefs={prefs}
        isPrefsDirty={isPrefsDirty}
        onUpdatePreference={onUpdatePreference}
        saving={saving}
        saved={saved}
        onSave={onSave}
      />

      <ContactsPreferencesDuplicateSection
        prefs={prefs}
        isPrefsDirty={isPrefsDirty}
        onUpdatePreference={onUpdatePreference}
        saving={saving}
        saved={saved}
        onSave={onSave}
      />
    </>
  );
}

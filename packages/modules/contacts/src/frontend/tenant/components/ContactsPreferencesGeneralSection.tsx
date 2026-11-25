import type React from "react";
import { Users } from "lucide-react";
import type { ContactPreferences } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { SectionCard } from "@mms/ui";
import { ToggleRow } from "@mms/ui";
import { SETUP_SECTION_CARD_CLASS } from "@mms/ui";

import { ModuleSetupSaveFooter } from "@mms/fe-core/components/ModuleSetupSaveFooter";

export interface ContactsPreferencesGeneralSectionProps {
  prefs: ContactPreferences;
  isPrefsDirty?: boolean;
  onUpdatePreference: <K extends keyof ContactPreferences>(
    key: K,
    value: ContactPreferences[K],
  ) => void;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

export function ContactsPreferencesGeneralSection({
  prefs,
  isPrefsDirty,
  onUpdatePreference,
  saving,
  saved,
  onSave,
}: ContactsPreferencesGeneralSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SectionCard
      title={t("contacts.setup.generalPreferences")}
      icon={Users}
      headingLevel={2}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <div className="space-y-2">
        <ToggleRow
          label={t("contacts.setup.showDetailedSolarAge")}
          description={t("contacts.setup.showDetailedSolarAgeDesc")}
          value={!!prefs.showDetailedSolarAge}
          onChange={(val) => onUpdatePreference("showDetailedSolarAge", val)}
        />
        <ToggleRow
          label={t("contacts.setup.showLunarDob")}
          description={t("contacts.setup.showLunarDobDesc")}
          value={!!prefs.showLunarDob}
          onChange={(val) => onUpdatePreference("showLunarDob", val)}
        />
        <ToggleRow
          label={t("contacts.setup.showDetailedLunarAge")}
          description={t("contacts.setup.showDetailedLunarAgeDesc")}
          value={!!prefs.showDetailedLunarAge}
          onChange={(val) => onUpdatePreference("showDetailedLunarAge", val)}
        />
      </div>

      {onSave ? (
        <ModuleSetupSaveFooter
          dirty={Boolean(isPrefsDirty)}
          saving={Boolean(saving)}
          saved={Boolean(saved)}
          saveLabel={saving ? t("global.saving") : t("contacts.setup.saveAndApply")}
          savedLabel={t("contacts.form.saved")}
          onSave={onSave}
          disableUnsavedGuard
          footerClassName="mt-4 pt-3"
        />
      ) : null}
    </SectionCard>
  );
}

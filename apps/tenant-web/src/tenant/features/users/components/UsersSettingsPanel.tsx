import React from "react";
import { SectionCard } from "@mms/ui";
import { Shield } from "lucide-react";
import { type UsersSettings } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { ToggleRow } from "@mms/ui";
import { ModuleSetupSaveFooter } from "@mms/fe-core/components/ModuleSetupSaveFooter";
import { SETUP_SECTION_CARD_CLASS } from "@mms/ui";
import { ModuleSetupContent } from "@mms/ui/app/ModuleSetupContent";

export interface UsersSettingsPanelProps {
  settingsDraft: UsersSettings;
  saved: boolean;
  saving: boolean;
  isDirty: boolean;
  upd: <K extends keyof UsersSettings>(field: K, value: UsersSettings[K]) => void;
  onSave: () => void | Promise<void>;
}

export const UsersSettingsPanel = function UsersSettingsPanel({
  settingsDraft,
  saved,
  saving,
  isDirty,
  upd,
  onSave,
}: UsersSettingsPanelProps): React.JSX.Element {
  const { t } = useTranslation();

  const unsavedWarning = isDirty ? t("users.setup.unsavedPreferencesWarning") : undefined;

  return (
    <ModuleSetupContent>
      <SectionCard
        accentColor="primary"
        icon={Shield}
        title={t("users.settingsPrefsTitle")}
        className={SETUP_SECTION_CARD_CLASS}
      >
        <div className="space-y-2 pt-1">
          <ToggleRow
            label={t("users.selfRegistration")}
            description={t("users.selfRegistrationDesc")}
            value={settingsDraft.allowSelfRegistration || false}
            onChange={(value) => upd("allowSelfRegistration", value)}
          />
          <ToggleRow
            label={t("users.emailVerification")}
            description={t("users.emailVerificationDesc")}
            value={settingsDraft.requireEmailVerification || false}
            onChange={(value) => upd("requireEmailVerification", value)}
          />
        </div>
      </SectionCard>

      <ModuleSetupSaveFooter
        dirty={isDirty}
        saving={saving}
        saved={saved}
        unsavedWarning={unsavedWarning}
        saveLabel={t("common.save")}
        savedLabel={t("settings.savedBadge")}
        onSave={onSave}
      />
    </ModuleSetupContent>
  );
};

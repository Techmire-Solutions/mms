import React from "react";
import { SectionCard } from "@/components/app/SectionCard";
import { Shield } from "lucide-react";
import { type UsersSettings } from "@mms/contracts";
import { useTranslation } from "@/hooks/useTranslation";
import { ToggleRow } from "@mms/ui";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { ModuleSetupContent } from "@/components/app/ModuleSetupContent";

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

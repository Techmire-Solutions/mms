import React, { useEffect } from "react";
import { Calendar } from "lucide-react";
import { SectionCard } from "@/components/app/SectionCard";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { SessionsSettingsPreferences } from "@/tenant/features/sessions/components/SessionsSettingsPreferences";
import { useSessionsSetupPanelState } from "@/tenant/features/sessions/hooks/useSessionsSetupPanelState";
import { ModuleSetupContent } from "@/components/app/ModuleSetupContent";

export interface SessionsSettingsProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const SessionsSettings = function SessionsSettings({
  onPrefsDirtyChange,
}: SessionsSettingsProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { settingsDraft, typeOptions, upd, saved, saving, isPrefsDirty, handleSave } =
    useSessionsSetupPanelState();

  useEffect(() => {
    onPrefsDirtyChange?.(isPrefsDirty);
  }, [isPrefsDirty, onPrefsDirtyChange]);

  const unsavedWarning = isPrefsDirty ? t("sessions.setup.unsavedPreferencesWarning") : undefined;
  const durationInvalid = !/^[1-9]\d*$/.test(settingsDraft.defaultDuration.trim());

  return (
    <ModuleSetupContent>
      <SectionCard
        title={t("sessions.settings.title")}
        icon={Calendar}
        accentColor="primary"
        className={SETUP_SECTION_CARD_CLASS}
      >
        <SessionsSettingsPreferences
          settingsDraft={settingsDraft}
          typeOptions={typeOptions}
          upd={upd}
          durationError={durationInvalid ? t("common.formPleaseFixErrors") : undefined}
        />
      </SectionCard>

      <ModuleSetupSaveFooter
        dirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        unsavedWarning={unsavedWarning}
        saveLabel={t("common.save")}
        savedLabel={t("settings.savedBadge")}
        onSave={handleSave}
        disabled={durationInvalid}
      />
    </ModuleSetupContent>
  );
};

export default SessionsSettings;

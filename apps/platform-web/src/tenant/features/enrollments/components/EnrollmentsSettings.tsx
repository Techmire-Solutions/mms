import React, { useEffect } from "react";
import { ClipboardList } from "lucide-react";
import { SectionCard } from "@mms/ui";
import { Alert } from "@mms/ui";
import { ModuleSetupSaveFooter } from "@mms/fe-core/components/ModuleSetupSaveFooter";
import { useTranslation } from "@mms/fe-core/i18n";
import { SETUP_SECTION_CARD_CLASS } from "@mms/ui";
import { EnrollmentsPreferencesSection } from "@/tenant/features/enrollments/components/EnrollmentsPreferencesSection";
import { useEnrollmentsSetupPanelState } from "@/tenant/features/enrollments/hooks/useEnrollmentsSetupPanelState";
import { ModuleSetupContent } from "@mms/ui/app/ModuleSetupContent";

export interface EnrollmentsSettingsProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const EnrollmentsSettings = function EnrollmentsSettings({
  onPrefsDirtyChange,
}: EnrollmentsSettingsProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const {
    settingsDraft,
    saved,
    saving,
    isPrefsDirty,
    preferenceErrors,
    saveError,
    upd,
    handleSave,
  } = useEnrollmentsSetupPanelState();

  useEffect(() => {
    onPrefsDirtyChange?.(isPrefsDirty);
  }, [isPrefsDirty, onPrefsDirtyChange]);

  const unsavedWarning = isPrefsDirty
    ? t("enrollments.setup.unsavedPreferencesWarning")
    : undefined;

  return (
    <ModuleSetupContent>
      <SectionCard
        title={t("enrollments.settings.title")}
        icon={ClipboardList}
        accentColor="primary"
        className={SETUP_SECTION_CARD_CLASS}
      >
        {saveError ? (
          <Alert
            role="alert"
            tone="destructive"
            title={t("settings.serverSaveFailed")}
            description={saveError}
          />
        ) : null}
        <EnrollmentsPreferencesSection
          settingsDraft={settingsDraft}
          upd={upd}
          errors={preferenceErrors}
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
      />
    </ModuleSetupContent>
  );
};

export default EnrollmentsSettings;

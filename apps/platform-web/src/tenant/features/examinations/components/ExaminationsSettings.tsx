import React, { useEffect } from "react";
import { FileText } from "lucide-react";
import { SectionCard } from "@mms/ui";
import { ModuleSetupSaveFooter } from "@mms/fe-core/components/ModuleSetupSaveFooter";
import { useTranslation } from "@mms/fe-core/i18n";
import { SETUP_SECTION_CARD_CLASS } from "@mms/ui";
import { ExaminationsPreferencesSection } from "@/tenant/features/examinations/components/ExaminationsPreferencesSection";
import { useExaminationsSetupPanelState } from "@/tenant/features/examinations/hooks/useExaminationsSetupPanelState";
import { ModuleSetupContent } from "@mms/ui/app/ModuleSetupContent";
import { useUnsavedChangesGuard } from "@mms/fe-core/hooks";

export interface ExaminationsSettingsProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const ExaminationsSettings = function ExaminationsSettings({
  onPrefsDirtyChange,
}: ExaminationsSettingsProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { settingsDraft, saved, saving, isPrefsDirty, errors, upd, handleSave } =
    useExaminationsSetupPanelState();

  useEffect(() => {
    onPrefsDirtyChange?.(isPrefsDirty);
  }, [isPrefsDirty, onPrefsDirtyChange]);
  useUnsavedChangesGuard({
    isDirty: isPrefsDirty,
    message: t("examinations.setup.unsavedPreferencesWarning"),
  });

  const unsavedWarning = isPrefsDirty
    ? t("examinations.setup.unsavedPreferencesWarning")
    : undefined;

  return (
    <ModuleSetupContent>
      <SectionCard
        accentColor="primary"
        icon={FileText}
        title={t("examinations.settings.titlePreferences")}
        className={SETUP_SECTION_CARD_CLASS}
      >
        <ExaminationsPreferencesSection settingsDraft={settingsDraft} upd={upd} errors={errors} />
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

export default ExaminationsSettings;

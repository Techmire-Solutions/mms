import React, { useEffect } from "react";
import { ClipboardList } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { ModuleSetupSaveFooter } from "@/components/ui/ModuleSetupSaveFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { EnrollmentsPreferencesSection } from "@/tenant/features/enrollments/components/EnrollmentsPreferencesSection";
import { useEnrollmentsSetupPanelState } from "@/tenant/features/enrollments/hooks/useEnrollmentsSetupPanelState";
import { ModuleSetupContent } from "@/components/ui/ModuleSetupContent";

export interface EnrollmentsSettingsProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const EnrollmentsSettings = function EnrollmentsSettings({
  onPrefsDirtyChange,
}: EnrollmentsSettingsProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { settingsDraft, saved, saving, isPrefsDirty, upd, handleSave } =
    useEnrollmentsSetupPanelState();

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
        <EnrollmentsPreferencesSection settingsDraft={settingsDraft} upd={upd} />
        <ModuleSetupSaveFooter
          dirty={isPrefsDirty}
          saving={saving}
          saved={saved}
          saveLabel={saving ? t("global.saving") : t("common.save")}
          savedLabel={t("settings.savedBadge")}
          onSave={handleSave}
          disableUnsavedGuard
          footerClassName="mt-4 pt-3"
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

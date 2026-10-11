import React, { useEffect } from "react";
import { ModuleSetupSaveFooter } from "@/components/ui/ModuleSetupSaveFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { StudentsPreferencesSection } from "@/tenant/features/students/components/StudentsPreferencesSection";
import { useStudentsSetupPanelState } from "@/tenant/features/students/hooks/useStudentsSetupPanelState";
import { ModuleSetupContent } from "@/components/ui/ModuleSetupContent";

export interface StudentsSetupPanelProps {
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const StudentsSetupPanel = function StudentsSetupPanel({
  onPrefsDirtyChange,
}: StudentsSetupPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const { settingsDraft, upd, saved, saving, isPrefsDirty, handleSave } =
    useStudentsSetupPanelState();

  useEffect(() => {
    onPrefsDirtyChange?.(isPrefsDirty);
  }, [isPrefsDirty, onPrefsDirtyChange]);

  const unsavedWarning = isPrefsDirty ? t("students.setup.unsavedPreferencesWarning") : undefined;

  return (
    <ModuleSetupContent>
      <StudentsPreferencesSection
        settingsDraft={settingsDraft}
        upd={upd}
        isPrefsDirty={isPrefsDirty}
        saving={saving}
        saved={saved}
      />

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
export default StudentsSetupPanel;

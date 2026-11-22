import React, { useEffect } from "react";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { ModuleSetupContent } from "@/components/app/ModuleSetupContent";
import { StudentsPreferencesSection } from "@/tenant/features/students/components/StudentsPreferencesSection";
import { StudentsRequiredFieldsSection } from "@/tenant/features/students/components/StudentsRequiredFieldsSection";
import { useStudentsSetupPanelState } from "@/tenant/features/students/hooks/useStudentsSetupPanelState";
import { useStudentsRequiredFieldsSetup } from "@/tenant/features/students/hooks/useStudentsRequiredFieldsSetup";

export interface StudentsSetupPanelProps {
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

/**
 * Students Setup → Preferences. Hosts both the module preferences and the required-fields
 * card, with one dirty state and one Save footer (preferences + field config are separate
 * endpoints, saved in sequence when both are dirty).
 */
export const StudentsSetupPanel = function StudentsSetupPanel({
  onPrefsDirtyChange,
}: StudentsSetupPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const { settingsDraft, upd, saved, saving, isPrefsDirty, handleSave } =
    useStudentsSetupPanelState();
  const requiredFields = useStudentsRequiredFieldsSetup();

  const isDirty = isPrefsDirty || requiredFields.isDirty;
  const isSaving = saving || requiredFields.saving;

  useEffect(() => {
    onPrefsDirtyChange?.(isDirty);
  }, [isDirty, onPrefsDirtyChange]);

  const handleSaveAll = async (): Promise<void> => {
    if (isPrefsDirty) await handleSave();
    if (requiredFields.isDirty) await requiredFields.save();
  };

  return (
    <ModuleSetupContent>
      <StudentsPreferencesSection
        settingsDraft={settingsDraft}
        upd={upd}
        isPrefsDirty={isPrefsDirty}
        saving={isSaving}
        saved={saved}
      />

      <StudentsRequiredFieldsSection state={requiredFields} />

      <ModuleSetupSaveFooter
        dirty={isDirty}
        saving={isSaving}
        saved={saved && !isDirty}
        unsavedWarning={isDirty ? t("students.setup.unsavedChanges") : undefined}
        saveLabel={t("common.save")}
        savedLabel={t("settings.savedBadge")}
        onSave={handleSaveAll}
      />
    </ModuleSetupContent>
  );
};
export default StudentsSetupPanel;

import React, { useEffect } from "react";
import { useTranslation } from "@mms/fe-core/i18n";
import { useFacultySetupPanelState } from "../hooks/useFacultySetupPanelState";
import { FacultyPreferencesSection } from "./FacultyPreferencesSection";
import { ModuleSetupContent } from "@mms/ui/app/ModuleSetupContent";

export interface FacultySettingsProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const FacultySettings = function FacultySettings({
  onPrefsDirtyChange,
}: FacultySettingsProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { settingsDraft, saved, saving, isPrefsDirty, upd, handleSave } =
    useFacultySetupPanelState();

  useEffect(() => {
    onPrefsDirtyChange?.(isPrefsDirty);
  }, [isPrefsDirty, onPrefsDirtyChange]);

  const unsavedWarning = isPrefsDirty ? t("faculty.setup.unsavedPreferencesWarning") : undefined;

  return (
    <ModuleSetupContent>
      <FacultyPreferencesSection
        settingsDraft={settingsDraft}
        upd={upd}
        isPrefsDirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        unsavedWarning={unsavedWarning}
        onSave={handleSave}
      />
    </ModuleSetupContent>
  );
};

export default FacultySettings;

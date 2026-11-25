import { useFacultyConfig } from "./useFacultyConfig";
import { type FacultySettings } from "@mms/contracts";
import { useModuleSettingsEditor } from "./useModuleSettingsEditor";
import { useFacultySetupSaveActions } from "./useFacultySetupSaveActions";

/** Faculty Setup panel state */
export function useFacultySetupPanelState() {
  const config = useFacultyConfig();
  const { settings, settingsDraft, saved, setSaved, upd, discardDrafts } =
    useModuleSettingsEditor<FacultySettings>({
      config,
    });

  const { saving, isPrefsDirty, handleSave } = useFacultySetupSaveActions({
    settings,
    settingsDraft,
    setSaved,
  });

  const discardSetupDrafts = () => {
    discardDrafts();
    setSaved(true);
  };

  return {
    settingsDraft,
    upd,
    saved,
    setSaved,
    saving,
    isPrefsDirty,
    isDirty: isPrefsDirty,
    handleSave,
    discardSetupDrafts,
  };
}

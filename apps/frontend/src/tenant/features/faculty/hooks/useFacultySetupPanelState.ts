import { useFacultyConfig } from "@/hooks/useStandardModuleConfig";
import { type FacultySettings } from "@mms/shared";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useFacultySetupSaveActions } from "@/tenant/features/faculty/hooks/useFacultySetupSaveActions";

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

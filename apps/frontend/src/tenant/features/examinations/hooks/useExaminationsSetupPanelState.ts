import { type ExaminationsSettings } from "@mms/shared";
import { useExaminationConfig } from "@/hooks/useStandardModuleConfig";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useExaminationsSetupSaveActions } from "@/tenant/features/examinations/hooks/useExaminationsSetupSaveActions";

export interface UseExaminationsSetupPanelStateReturn {
  settings: ExaminationsSettings;
  settingsDraft: ExaminationsSettings;
  upd: <K extends keyof ExaminationsSettings>(field: K, value: ExaminationsSettings[K]) => void;
  saved: boolean;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
  saving: boolean;
  isPrefsDirty: boolean;
  isDirty: boolean;
  handleSave: () => Promise<void>;
}

/** Examinations Setup panel state — encapsulates config, editor draft, dirty check, and save actions. */
export function useExaminationsSetupPanelState(): UseExaminationsSetupPanelStateReturn {
  const config = useExaminationConfig();
  const { settings, settingsDraft, saved, setSaved, upd, saveSettingsAsync } =
    useModuleSettingsEditor<ExaminationsSettings>({
      config,
    });

  const { saving, isPrefsDirty, handleSave } = useExaminationsSetupSaveActions({
    settings,
    settingsDraft,
    setSaved,
    saveSettingsAsync,
  });

  return {
    settings,
    settingsDraft,
    upd,
    saved,
    setSaved,
    saving,
    isPrefsDirty,
    isDirty: isPrefsDirty,
    handleSave,
  };
}

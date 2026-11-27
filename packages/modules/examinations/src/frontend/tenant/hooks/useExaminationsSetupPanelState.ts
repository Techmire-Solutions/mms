import { type ExaminationsSettings } from "@mms/contracts";
import { useExaminationConfig } from "../host/useStandardModuleConfig";
import { useModuleSettingsEditor } from "../host/useModuleSettingsEditor";
import { useExaminationsSetupSaveActions } from "./useExaminationsSetupSaveActions";

export interface UseExaminationsSetupPanelStateReturn {
  settings: ExaminationsSettings;
  settingsDraft: ExaminationsSettings;
  upd: <K extends keyof ExaminationsSettings>(field: K, value: ExaminationsSettings[K]) => void;
  saved: boolean;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
  saving: boolean;
  isPrefsDirty: boolean;
  isDirty: boolean;
  errors: { passMark?: string; maxMark?: string };
  handleSave: () => Promise<void>;
}

/** Examinations Setup panel state — encapsulates config, editor draft, dirty check, and save actions. */
export function useExaminationsSetupPanelState(): UseExaminationsSetupPanelStateReturn {
  const config = useExaminationConfig();
  const { settings, settingsDraft, saved, setSaved, upd, saveSettingsAsync } =
    useModuleSettingsEditor<ExaminationsSettings>({
      config,
    });

  const { saving, isPrefsDirty, errors, handleSave } = useExaminationsSetupSaveActions({
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
    errors,
    handleSave,
  };
}

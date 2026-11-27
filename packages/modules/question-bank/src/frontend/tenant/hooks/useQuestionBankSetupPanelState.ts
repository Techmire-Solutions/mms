import { type QuestionBankSettings } from "@mms/contracts";
import { useQuestionBankConfig } from "./useQuestionBankConfig";
import { useModuleSettingsEditor } from "../host/useModuleSettingsEditor";
import { useQuestionBankSetupSaveActions } from "./useQuestionBankSetupSaveActions";

export interface UseQuestionBankSetupPanelStateReturn {
  settings: QuestionBankSettings;
  settingsDraft: QuestionBankSettings;
  upd: <K extends keyof QuestionBankSettings>(field: K, value: QuestionBankSettings[K]) => void;
  saved: boolean;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
  saving: boolean;
  isPrefsDirty: boolean;
  isDirty: boolean;
  handleSave: () => Promise<void>;
}

/** Question Bank Setup panel state — encapsulates config, editor draft, dirty check, and save actions. */
export function useQuestionBankSetupPanelState(): UseQuestionBankSetupPanelStateReturn {
  const config = useQuestionBankConfig();
  const { settings, settingsDraft, saved, setSaved, upd, saveSettingsAsync } =
    useModuleSettingsEditor<QuestionBankSettings>({
      config,
    });

  const { saving, isPrefsDirty, handleSave } = useQuestionBankSetupSaveActions({
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

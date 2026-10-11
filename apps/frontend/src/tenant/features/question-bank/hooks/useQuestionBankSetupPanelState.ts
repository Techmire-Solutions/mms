import { type QuestionBankSettings } from "@mms/shared";
import { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useQuestionBankSetupSaveActions } from "@/tenant/features/question-bank/hooks/useQuestionBankSetupSaveActions";

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

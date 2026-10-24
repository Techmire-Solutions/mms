import { type FinanceSettings } from "@mms/shared";
import { useFinanceConfig } from "@/hooks/useStandardModuleConfig";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useFinanceSetupSaveActions } from "@/tenant/features/finance/hooks/useFinanceSetupSaveActions";

export interface UseFinanceSetupPanelStateReturn {
  settings: FinanceSettings;
  settingsDraft: FinanceSettings;
  upd: <K extends keyof FinanceSettings>(field: K, value: FinanceSettings[K]) => void;
  saved: boolean;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
  saving: boolean;
  isPrefsDirty: boolean;
  isDirty: boolean;
  handleSave: () => Promise<void>;
}

/** Finance Setup panel state — encapsulates config, editor draft, dirty check, and save actions. */
export function useFinanceSetupPanelState(): UseFinanceSetupPanelStateReturn {
  const config = useFinanceConfig();
  const { settings, settingsDraft, saved, setSaved, upd, saveSettingsAsync } =
    useModuleSettingsEditor<FinanceSettings>({
      config,
    });

  const { saving, isPrefsDirty, handleSave } = useFinanceSetupSaveActions({
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

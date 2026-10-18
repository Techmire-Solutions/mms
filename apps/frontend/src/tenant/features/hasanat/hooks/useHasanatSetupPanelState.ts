import { type HasanatSettings } from "@mms/shared";
import { useHasanatConfig } from "@/hooks/useStandardModuleConfig";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useHasanatSetupSaveActions } from "@/tenant/features/hasanat/hooks/useHasanatSetupSaveActions";

export interface UseHasanatSetupPanelStateReturn {
  settings: HasanatSettings;
  settingsDraft: HasanatSettings;
  upd: <K extends keyof HasanatSettings>(field: K, value: HasanatSettings[K]) => void;
  saved: boolean;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
  saving: boolean;
  isPrefsDirty: boolean;
  isDirty: boolean;
  handleSave: () => Promise<void>;
}

/** Hasanat Setup panel state — encapsulates config, editor draft, dirty check, and save actions. */
export function useHasanatSetupPanelState(): UseHasanatSetupPanelStateReturn {
  const config = useHasanatConfig();
  const { settings, settingsDraft, saved, setSaved, upd, saveSettingsAsync } =
    useModuleSettingsEditor<HasanatSettings>({
      config,
    });

  const { saving, isPrefsDirty, handleSave } = useHasanatSetupSaveActions({
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

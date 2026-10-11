import { type SessionsSettings } from "@mms/shared";
import { useSessionConfig } from "@/hooks/useStandardModuleConfig";
import { SESSION_TYPES } from "@/lib/data/sessionsData";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useSessionsSetupSaveActions } from "@/tenant/features/sessions/hooks/useSessionsSetupSaveActions";

export interface UseSessionsSetupPanelStateReturn {
  settingsDraft: SessionsSettings;
  typeOptions: string[];
  upd: <K extends keyof SessionsSettings>(field: K, value: SessionsSettings[K]) => void;
  saved: boolean;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
  saving: boolean;
  isPrefsDirty: boolean;
  isDirty: boolean;
  handleSave: () => Promise<void>;
}

/** Sessions Setup panel state — encapsulates config, editor state, dirty check, and save actions. */
export function useSessionsSetupPanelState(): UseSessionsSetupPanelStateReturn {
  const config = useSessionConfig();
  const { types } = config;
  const { settings, settingsDraft, saved, setSaved, upd, saveSettingsAsync } =
    useModuleSettingsEditor<SessionsSettings>({
      config,
    });

  const typeOptions = (() => (types.length > 0 ? types : [...SESSION_TYPES]))();

  const { saving, isPrefsDirty, handleSave } = useSessionsSetupSaveActions({
    settings,
    settingsDraft,
    setSaved,
    saveSettingsAsync,
  });

  return {
    settingsDraft,
    typeOptions,
    upd,
    saved,
    setSaved,
    saving,
    isPrefsDirty,
    isDirty: isPrefsDirty,
    handleSave,
  };
}

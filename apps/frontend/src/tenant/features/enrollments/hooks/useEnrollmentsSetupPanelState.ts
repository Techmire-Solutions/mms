import { type EnrollmentsSettings } from "@mms/shared";
import { useEnrollmentConfig } from "@/hooks/useStandardModuleConfig";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useEnrollmentsSetupSaveActions } from "@/tenant/features/enrollments/hooks/useEnrollmentsSetupSaveActions";

export interface UseEnrollmentsSetupPanelStateReturn {
  settingsDraft: EnrollmentsSettings;
  upd: <K extends keyof EnrollmentsSettings>(field: K, value: EnrollmentsSettings[K]) => void;
  saved: boolean;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
  saving: boolean;
  isPrefsDirty: boolean;
  isDirty: boolean;
  handleSave: () => Promise<void>;
}

/** Enrollments Setup panel state — encapsulates config, editor draft, dirty check, and save actions. */
export function useEnrollmentsSetupPanelState(): UseEnrollmentsSetupPanelStateReturn {
  const config = useEnrollmentConfig();
  const { settings, settingsDraft, saved, setSaved, upd, saveSettingsAsync } =
    useModuleSettingsEditor<EnrollmentsSettings>({
      config,
    });

  const { saving, isPrefsDirty, handleSave } = useEnrollmentsSetupSaveActions({
    settings,
    settingsDraft,
    setSaved,
    saveSettingsAsync,
  });

  return {
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

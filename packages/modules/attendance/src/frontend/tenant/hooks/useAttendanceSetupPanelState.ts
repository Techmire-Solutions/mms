import { type AttendanceSettings } from "@mms/contracts";
import { useAttendanceConfig } from "../host/useAttendanceConfig";
import { useModuleSettingsEditor } from "../host/useModuleSettingsEditor";
import { useAttendanceSetupSaveActions } from "./useAttendanceSetupSaveActions";

export interface UseAttendanceSetupPanelStateReturn {
  settingsDraft: AttendanceSettings;
  upd: <K extends keyof AttendanceSettings>(field: K, value: AttendanceSettings[K]) => void;
  saved: boolean;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
  saving: boolean;
  isPrefsDirty: boolean;
  isDirty: boolean;
  handleSave: () => Promise<void>;
}

/** Attendance Setup panel state — encapsulates config, editor draft, dirty check, and save actions. */
export function useAttendanceSetupPanelState(): UseAttendanceSetupPanelStateReturn {
  const config = useAttendanceConfig();
  const { settings, settingsDraft, saved, setSaved, upd, saveSettingsAsync } =
    useModuleSettingsEditor<AttendanceSettings>({
      config,
    });

  const { saving, isPrefsDirty, handleSave } = useAttendanceSetupSaveActions({
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

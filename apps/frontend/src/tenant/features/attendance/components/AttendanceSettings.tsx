import React, { useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { AttendanceSettingsPreferencesSection } from "@/tenant/features/attendance/components/AttendanceSettingsPreferencesSection";
import { useAttendanceSetupPanelState } from "@/tenant/features/attendance/hooks/useAttendanceSetupPanelState";
import { ModuleSetupContent } from "@/components/app/ModuleSetupContent";

export interface AttendanceSettingsProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const AttendanceSettings = function AttendanceSettings({
  onPrefsDirtyChange,
}: AttendanceSettingsProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { settingsDraft, saved, saving, isPrefsDirty, upd, handleSave } =
    useAttendanceSetupPanelState();

  useEffect(() => {
    onPrefsDirtyChange?.(isPrefsDirty);
  }, [isPrefsDirty, onPrefsDirtyChange]);

  const unsavedWarning = isPrefsDirty ? t("attendance.setup.unsavedPreferencesWarning") : undefined;

  return (
    <ModuleSetupContent>
      <AttendanceSettingsPreferencesSection
        settingsDraft={settingsDraft}
        upd={upd}
        isPrefsDirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        onSave={handleSave}
      />

      <ModuleSetupSaveFooter
        dirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        unsavedWarning={unsavedWarning}
        saveLabel={t("common.save")}
        savedLabel={t("settings.savedBadge")}
        onSave={handleSave}
      />
    </ModuleSetupContent>
  );
};

export default AttendanceSettings;

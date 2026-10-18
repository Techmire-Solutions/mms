import { useState } from "react";
import { type AttendanceSettings } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";

const PREF_KEYS = [
  "workingDays",
  "cutoffTime",
  "lateThresholdMins",
  "autoAbsentAfterMins",
  "qrEnabled",
  "lowAttendanceThreshold",
  "notifyParents",
  "requireNoteForAbsent",
  "lockAfterSubmit",
  "trackHalfDay",
  "weeklyReport",
  "attendanceAlerts",
  "allowManualOverride",
  "offlineEnabled",
  "geoTagging",
  "allowExtraClassOnHolidays",
  "defaultViewLayout",
] as const;

/** Attendance Setup save + dirty detection (§7 await / dirty). */
export function useAttendanceSetupSaveActions({
  settings,
  settingsDraft,
  setSaved,
  saveSettingsAsync,
}: {
  settings: AttendanceSettings;
  settingsDraft: AttendanceSettings;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
  saveSettingsAsync: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const isPrefsDirty = (() => {
    return PREF_KEYS.some(
      (key) =>
        JSON.stringify(Reflect.get(settingsDraft, key)) !==
        JSON.stringify(Reflect.get(settings, key)),
    );
  })();

  const handleSave = (async (): Promise<void> => {
    if (!isPrefsDirty || saving) return;
    setSaving(true);
    try {
      await saveSettingsAsync();
      notify.success(t("attendance.settings.saved"));
      setSaved(true);
    } catch (error) {
      notify.error(t("settings.serverSaveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  });

  return {
    saving,
    isPrefsDirty,
    handleSave,
  };
}

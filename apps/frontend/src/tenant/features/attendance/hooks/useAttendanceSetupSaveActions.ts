import { useMemo, useState } from "react";
import { attendancePreferencesPutBodySchema, type AttendanceSettings } from "@mms/shared";
import { translateValidationMessage } from "@/lib/forms/translateValidationMessage";
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

  const isPrefsDirty = useMemo(() => {
    return PREF_KEYS.some(
      (key) =>
        JSON.stringify(Reflect.get(settingsDraft, key)) !==
        JSON.stringify(Reflect.get(settings, key)),
    );
  }, [settings, settingsDraft]);

  const handleSave = async (): Promise<void> => {
    if (!isPrefsDirty || saving) return;
    const parsed = attendancePreferencesPutBodySchema.safeParse(settingsDraft);
    if (!parsed.success) {
      notify.error(t("attendance.settings.invalid"), {
        description: translateValidationMessage(parsed.error.issues[0]?.message, t),
      });
      return;
    }
    if (settingsDraft.workingDays.length === 0) {
      notify.error(t("attendance.settings.workingDaysRequired"));
      return;
    }
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
  };

  return {
    saving,
    isPrefsDirty,
    handleSave,
  };
}

import { useState } from "react";
import { type SessionsSettings } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";

const PREF_KEYS = [
  "defaultDuration",
  "defaultSessionType",
  "allowOverlap",
  "archiveOldSessions",
  "requireBudget",
  "timetableConflictCheck",
  "notifyOnSessionStart",
  "academicYear",
  "sessionStart",
  "defaultViewLayout",
] as const;

/** Sessions Setup save + dirty detection (§7 await / dirty). */
export function useSessionsSetupSaveActions({
  settings,
  settingsDraft,
  setSaved,
  saveSettingsAsync,
}: {
  settings: SessionsSettings;
  settingsDraft: SessionsSettings;
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

  const handleSave = async (): Promise<void> => {
    if (!isPrefsDirty || saving) return;
    setSaving(true);
    try {
      await saveSettingsAsync();
      notify.success(t("sessions.settings.saved"));
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

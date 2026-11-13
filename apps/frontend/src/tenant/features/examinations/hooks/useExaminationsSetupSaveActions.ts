import { useState } from "react";
import { type ExaminationsSettings } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";

const PREF_KEYS = [
  "passMark",
  "maxMark",
  "gradingSystem",
  "showRankings",
  "allowRetake",
  "autoPublishResults",
  "notifyOnResult",
  "certificateTemplate",
  "aiGrading",
  "distinguishHonours",
  "examReminders",
  "defaultViewLayout",
] as const;

/** Examinations Setup save + dirty detection (§7 await / dirty). */
export function useExaminationsSetupSaveActions({
  settings,
  settingsDraft,
  setSaved,
  saveSettingsAsync,
}: {
  settings: ExaminationsSettings;
  settingsDraft: ExaminationsSettings;
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

  // Pass/max are free-text settings today; a non-numeric or inverted pair must not be saved.
  const numeric = (value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed === "" || !/^\d+(\.\d+)?$/.test(trimmed)) return null;
    return Number(trimmed);
  };
  const passMark = numeric(settingsDraft.passMark);
  const maxMark = numeric(settingsDraft.maxMark);
  const errors: { passMark?: string; maxMark?: string } = {};
  if (passMark === null || passMark < 0) {
    errors.passMark = t("examinations.settings.validation.passMarkInvalid");
  }
  if (maxMark === null || maxMark <= 0) {
    errors.maxMark = t("examinations.settings.validation.maxMarkInvalid");
  }
  if (
    !errors.passMark &&
    !errors.maxMark &&
    passMark !== null &&
    maxMark !== null &&
    passMark > maxMark
  ) {
    errors.passMark = t("examinations.settings.validation.passExceedsMax");
  }

  const handleSave = async (): Promise<void> => {
    if (!isPrefsDirty || saving) return;
    if (errors.passMark || errors.maxMark) {
      notify.error(t("examinations.settings.saveFailed"), {
        description: errors.passMark ?? errors.maxMark,
      });
      return;
    }
    setSaving(true);
    try {
      await saveSettingsAsync();
      notify.success(t("examinations.settings.saved"));
      setSaved(true);
    } catch (error) {
      notify.error(t("examinations.settings.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  return {
    saving,
    isPrefsDirty,
    errors,
    handleSave,
  };
}

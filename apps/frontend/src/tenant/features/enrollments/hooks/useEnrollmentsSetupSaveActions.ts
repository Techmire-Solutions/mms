import { useState } from "react";
import { validateEnrollmentPreferences, type EnrollmentsSettings } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";

const PREF_KEYS = [
  "maxStudentsPerClass",
  "waitlistEnabled",
  "waitlistOfferHours",
  "requireEligibilityCheck",
  "autoAssignClass",
  "enrollmentApproval",
  "allowTransfers",
  "dropDeadlineDays",
  "reenrollmentReminder",
  "defaultViewLayout",
] as const;

/** Enrollments Setup save + dirty detection (§7 await / dirty). */
export function useEnrollmentsSetupSaveActions({
  settings,
  settingsDraft,
  setSaved,
  saveSettingsAsync,
}: {
  settings: EnrollmentsSettings;
  settingsDraft: EnrollmentsSettings;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
  saveSettingsAsync: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const issues = validateEnrollmentPreferences(settingsDraft);
  const preferenceErrors = Object.fromEntries(
    issues.map((issue) => [
      issue.field,
      issue.code === "required"
        ? t("enrollments.settings.invalidRequired")
        : issue.code === "integer"
          ? t("enrollments.settings.invalidInteger")
          : issue.code === "layout"
            ? t("enrollments.settings.invalidLayout")
            : t("enrollments.settings.invalidRange"),
    ]),
  ) as Partial<Record<keyof EnrollmentsSettings, string>>;
  const visibleErrors = attempted ? preferenceErrors : {};

  const isPrefsDirty = (() => {
    return PREF_KEYS.some(
      (key) =>
        JSON.stringify(Reflect.get(settingsDraft, key)) !==
        JSON.stringify(Reflect.get(settings, key)),
    );
  })();

  const handleSave = async (): Promise<void> => {
    setAttempted(true);
    if (!isPrefsDirty || saving || issues.length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveSettingsAsync();
      notify.success(t("enrollments.settings.saved"));
      setSaved(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveError(message);
      notify.error(t("settings.serverSaveFailed"), { description: message });
    } finally {
      setSaving(false);
    }
  };

  return {
    saving,
    isPrefsDirty,
    handleSave,
    preferenceErrors: visibleErrors,
    saveError,
  };
}

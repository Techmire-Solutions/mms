import { useState } from "react";
import { type QuestionBankSettings } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";

const PREF_KEYS = [
  "aiGrading",
  "defaultTestDuration",
  "categories",
  "sourceBooks",
  "questionTypes",
  "difficultyLevels",
  "defaultViewLayout",
] as const;

/** Question Bank Setup save + dirty detection (§7 await / dirty). */
export function useQuestionBankSetupSaveActions({
  settings,
  settingsDraft,
  setSaved,
  saveSettingsAsync,
}: {
  settings: QuestionBankSettings;
  settingsDraft: QuestionBankSettings;
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
      notify.success(t("questionBank.settingsSaved"), {
        description: t("questionBank.settingsSavedDesc"),
      });
      setSaved(true);
    } catch (error) {
      notify.error(t("questionBank.settingsSaveFailed"), {
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

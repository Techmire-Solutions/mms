import { useState } from "react";
import { type UsersSettings } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";

const PREF_KEYS = [
  "allowSelfRegistration",
  "requireEmailVerification",
  "defaultViewLayout",
  "workspaceRoles",
] as const;

/** Users Setup save + dirty detection (§7 await / dirty). */
export function useUsersSetupSaveActions({
  settings,
  settingsDraft,
  setSaved,
  saveSettingsAsync,
}: {
  settings: UsersSettings;
  settingsDraft: UsersSettings;
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
      notify.success(t("users.settingsSaved"), { description: t("users.settingsSavedDesc") });
      setSaved(true);
    } catch (error) {
      notify.error(t("errors.module.title"), {
        description: error instanceof Error ? error.message : t("errors.module.description"),
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

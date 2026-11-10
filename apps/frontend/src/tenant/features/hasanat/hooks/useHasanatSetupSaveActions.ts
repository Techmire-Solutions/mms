import { useState } from "react";
import { type HasanatSettings } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";

/** Every editable preference must be listed here, or its control saves nothing (dirty stays false). */
const PREF_KEYS = [
  "pointsPerUnit",
  "autoApprovePayouts",
  "defaultViewLayout",
  "awardScope",
] as const satisfies readonly (keyof HasanatSettings)[];

/** Hasanat Setup save + dirty detection (§7 await / dirty). */
export function useHasanatSetupSaveActions({
  settings,
  settingsDraft,
  setSaved,
  saveSettingsAsync,
}: {
  settings: HasanatSettings;
  settingsDraft: HasanatSettings;
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
      notify.success(t("hasanat.settings.saved"));
      setSaved(true);
    } catch (error) {
      notify.error(t("hasanat.settings.saveFailed"), {
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

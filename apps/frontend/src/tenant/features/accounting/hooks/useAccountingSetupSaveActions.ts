import { useState } from "react";
import { type AccountingSettings } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { getApiValidationMessage } from "@/lib/apiValidationMessage";
import { notify } from "@/lib/notify";
import { ACCOUNTING_PREFERENCES_KEYS } from "@/tenant/features/accounting/hooks/accountingSetupConfigApi";

/**
 * Best-available message for a failed accounting write.
 *
 * ts-rest rejects with a plain `{ status, body }` object rather than an `Error`,
 * so the previous `error instanceof Error ? error.message : String(error)` sent
 * `"[object Object]"` to the toast and hid every server validation message —
 * e.g. "Retained earnings account is required to close a fiscal year".
 */
export function accountingErrorMessage(error: unknown): string | undefined {
  const apiMessage = getApiValidationMessage(error);
  if (apiMessage) return apiMessage;
  if (error instanceof Error && error.message.trim()) return error.message;
  return undefined;
}

/** Accounting Setup save + dirty detection (§7 await / dirty). */
export function useAccountingSetupSaveActions({
  settings,
  settingsDraft,
  setSaved,
  saveSettingsAsync,
  prefsReady,
}: {
  settings: AccountingSettings;
  settingsDraft: AccountingSettings;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
  saveSettingsAsync: () => Promise<void>;
  /** False while the stored preferences row has not been read yet. */
  prefsReady: boolean;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const isPrefsDirty = (() => {
    return ACCOUNTING_PREFERENCES_KEYS.some(
      (key) =>
        JSON.stringify(Reflect.get(settingsDraft, key)) !==
        JSON.stringify(Reflect.get(settings, key)),
    );
  })();

  const handleSave = async (): Promise<void> => {
    if (!isPrefsDirty || saving) return;
    // Saving before the stored row has loaded would PUT the placeholder
    // defaults over real preferences — including `retainedEarningsAccount`,
    // which period close requires. Refuse instead of overwriting silently.
    if (!prefsReady) return;
    setSaving(true);
    try {
      // Awaits the real PUT /api/accounting/preferences; a rejection is what
      // keeps the success toast off the screen.
      await saveSettingsAsync();
      notify.success(t("accounting.settings.saved"));
      setSaved(true);
    } catch (error) {
      notify.error(t("accounting.settings.saveFailed"), {
        description: accountingErrorMessage(error),
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

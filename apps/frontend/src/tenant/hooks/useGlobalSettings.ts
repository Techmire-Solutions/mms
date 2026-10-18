import { useState, useEffect } from "react";
import { type GlobalSettings } from "@mms/shared";
import { getScopedGlobalSettings } from "@/lib/settingsPreviewStore";
import { SETTINGS_PREVIEW_EVENT } from "@/lib/settingsPreview";

/**
 * Reactive read of `global_settings` — includes live preview overlay; refreshes on save or preview.
 */
export function useGlobalSettings(): GlobalSettings {
  const [settings, setSettings] = useState<GlobalSettings>(() => getScopedGlobalSettings());

  useEffect(() => {
    const handleUpdate = (): void => {
      setSettings(getScopedGlobalSettings());
    };

    window.addEventListener("local-database-update", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    window.addEventListener(SETTINGS_PREVIEW_EVENT, handleUpdate);

    return () => {
      window.removeEventListener("local-database-update", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener(SETTINGS_PREVIEW_EVENT, handleUpdate);
    };
  }, []);

  return settings;
}

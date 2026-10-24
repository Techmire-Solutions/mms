import { useEffect, useState } from "react";
import { useSavedFlash } from "@/tenant/hooks/useSavedFlash";
import {
  DEFAULT_BRANDING_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
  formatBrandingFooterDefault,
  formatThemeDisplayModeSummary,
  mergeGlobalSettings,
  normalizeThemeMode,
  resolveBrandingThemeMode,
  type BrandingSettings,
  type ThemeMode,
} from "@mms/shared";
import { getEffectiveGlobalSettings, getGlobalSettings, saveGlobalSettingsAsync } from "@/lib/db";
import { clearGlobalSettingsPreview, previewGlobalSettings } from "@/lib/settingsPreview";
import { serverSyncErrorKey } from "@/lib/serverSyncErrors";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { useSettingsBrandingDraft } from "@/lib/contexts/SettingsBrandingDraftContext";

export interface UseThemeSettingsDraftResult {
  data: BrandingSettings;
  displayMode: ThemeMode;
  setDisplayMode: (mode: ThemeMode) => void;
  previewMode: "light" | "dark";
  displayModeSummary: string;
  isDirty: boolean;
  saving: boolean;
  saved: boolean;
  upd: ReturnType<typeof useSettingsBrandingDraft>["upd"];
  handleSave: () => Promise<void>;
  handleResetToDefaults: () => void;
  handleDiscardChanges: () => void;
  defaultFooterPreview: string;
}

function loadPersistedThemeMode(): ThemeMode {
  return normalizeThemeMode(getGlobalSettings().theme);
}

function loadEffectiveThemeMode(): ThemeMode {
  return normalizeThemeMode(getEffectiveGlobalSettings().theme);
}

/**
 * Theme tab draft — display mode (global) + appearance fields (branding record).
 */
export function useThemeSettingsDraft(
  saveSuccessMessage: string,
  saveSuccessDescription: string,
): UseThemeSettingsDraftResult {
  const { t, language } = useTranslation();
  const { saved: savedFlash, flashSaved, clearSaved: clearSavedFlash } = useSavedFlash();
  const branding = useSettingsBrandingDraft();

  const [themeBaseline, setThemeBaseline] = useState(loadPersistedThemeMode);
  const [displayMode, setDisplayModeState] = useState(loadEffectiveThemeMode);
  const [themeSaving, setThemeSaving] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  const displayModeDirty = displayMode !== themeBaseline;
  const isDirty = branding.isThemeFieldsDirty || displayModeDirty;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (): void => setSystemPrefersDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const sync = (): void => {
      if (displayModeDirty) return;
      setDisplayModeState(loadEffectiveThemeMode());
      setThemeBaseline(loadPersistedThemeMode());
    };
    window.addEventListener("local-database-update", sync);
    return () => window.removeEventListener("local-database-update", sync);
  }, [displayModeDirty]);

  useEffect(() => {
    const effective = getEffectiveGlobalSettings();
    previewGlobalSettings({
      theme: normalizeThemeMode(displayMode),
      language: effective.language,
    });
  }, [displayMode]);

  const previewMode = resolveBrandingThemeMode(displayMode, systemPrefersDark);

  const displayModeSummary = (() =>
    formatThemeDisplayModeSummary(displayMode, previewMode, language))();

  const defaultFooterPreview = (() =>
    formatBrandingFooterDefault(branding.data.madrasaName, language))();

  const setDisplayMode = (mode: ThemeMode): void => {
    setDisplayModeState(normalizeThemeMode(mode));
    clearSavedFlash();
  };

  const handleSave = async (): Promise<void> => {
    const wasBrandingDirty = branding.isThemeFieldsDirty;

    if (wasBrandingDirty) {
      const ok = await branding.handleSave(
        { saveSuccessMessage, saveSuccessDescription },
        { skipToast: true },
      );
      if (!ok) return;
    }

    let savedThemeMode = false;
    if (displayModeDirty) {
      setThemeSaving(true);
      try {
        const current = getGlobalSettings();
        const result = await saveGlobalSettingsAsync(
          mergeGlobalSettings({ ...current, theme: normalizeThemeMode(displayMode) }),
        );
        if (!result.ok) {
          notify.error(t("settings.serverSaveFailed"), {
            description: t(serverSyncErrorKey(result.status)),
          });
          return;
        }
        setThemeBaseline(normalizeThemeMode(displayMode));
        clearGlobalSettingsPreview();
        savedThemeMode = true;
      } finally {
        setThemeSaving(false);
      }
    }

    if (wasBrandingDirty || savedThemeMode) {
      flashSaved();
      notify.success(saveSuccessMessage, { description: saveSuccessDescription });
    }
  };

  const handleResetToDefaults = (): void => {
    setDisplayModeState(DEFAULT_GLOBAL_SETTINGS.theme);
    branding.upd("primaryColor", DEFAULT_BRANDING_SETTINGS.primaryColor);
    branding.upd("secondaryColor", DEFAULT_BRANDING_SETTINGS.secondaryColor);
    branding.upd("cornerStyle", DEFAULT_BRANDING_SETTINGS.cornerStyle);
    branding.upd("footerText", "");
    clearSavedFlash();
  };

  const handleDiscardChanges = (): void => {
    setDisplayModeState(themeBaseline);
    branding.upd("primaryColor", branding.baseline.primaryColor);
    branding.upd("secondaryColor", branding.baseline.secondaryColor);
    branding.upd("cornerStyle", branding.baseline.cornerStyle);
    branding.upd("footerText", branding.baseline.footerText);
    clearSavedFlash();
  };

  const saved = !isDirty && (branding.saved || savedFlash);

  return {
    data: branding.data,
    displayMode,
    setDisplayMode,
    previewMode,
    displayModeSummary,
    isDirty,
    saving: branding.saving || themeSaving,
    saved,
    upd: branding.upd,
    handleSave,
    handleResetToDefaults,
    handleDiscardChanges,
    defaultFooterPreview,
  };
}

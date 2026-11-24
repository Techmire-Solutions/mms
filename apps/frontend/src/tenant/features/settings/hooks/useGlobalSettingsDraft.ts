import { useEffect, useEffectEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MODULE_ACCESS_QUERY_KEY } from "@/lib/query/moduleAccessQuery";
import {
  mergeGlobalSettings,
  normalizeEnabledModules,
  normalizePasswordPolicy,
  normalizeSessionTimeout,
  parseSessionTimeoutMinutes,
  type GlobalSettings,
} from "@mms/contracts";
import { applyDocumentLanguage } from "@/lib/documentLanguage";
import { getGlobalSettings, saveGlobalSettingsAsync } from "@/lib/db";
import { clearGlobalSettingsPreview, previewGlobalSettings } from "@/lib/settingsPreview";
import { serverSyncErrorKey } from "@/lib/serverSyncErrors";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { useSavedFlash } from "@/hooks/useSavedFlash";
import {
  isEnabledModulesDraftDirty,
  isGlobalPreferencesDirty,
  mergeGlobalSettingsDraft,
  previewGlobalSettingsDraft,
  retainGlobalDraftAfterModulesSave,
  retainModulesDraftAfterGlobalSave,
} from "@/lib/settingsGlobalDraft";

export interface UseGlobalSettingsDraftSaveToast {
  saveSuccessMessage: string;
  saveSuccessDescription: string;
}

export interface UseGlobalSettingsDraftResult {
  data: GlobalSettings;
  baseline: GlobalSettings;
  isGlobalDirty: boolean;
  isModulesDirty: boolean;
  saved: boolean;
  saving: boolean;
  upd: <K extends keyof GlobalSettings>(field: K, value: GlobalSettings[K]) => void;
  handleSaveGlobal: (toast?: UseGlobalSettingsDraftSaveToast) => Promise<boolean>;
  handleSaveModules: (toast?: UseGlobalSettingsDraftSaveToast) => Promise<boolean>;
  handleDiscardGlobal: () => void;
  handleDiscardModules: () => void;
  applyPersisted: (globalSettings: GlobalSettings) => void;
  clearSaved: () => void;
}

function loadPersistedGlobal(): GlobalSettings {
  return mergeGlobalSettings(getGlobalSettings());
}

function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function useGlobalSettingsDraft(): UseGlobalSettingsDraftResult {
  const { t } = useTranslation();
  const { saved, flashSaved, clearSaved } = useSavedFlash();
  const queryClient = useQueryClient();
  const [baseline, setBaseline] = useState<GlobalSettings>(loadPersistedGlobal);
  const [data, setData] = useState<GlobalSettings>(loadPersistedGlobal);
  const [saving, setSaving] = useState(false);

  const isGlobalDirty = (() => isGlobalPreferencesDirty(data, baseline))();
  const isModulesDirty = (() => isEnabledModulesDraftDirty(data, baseline))();
  const isDirty = isGlobalDirty || isModulesDirty;

  // Effect event: always reads the latest draft/flash state, so the listener
  // below is registered once instead of per render (clearSaved identity churns).
  const syncFromPersisted = useEffectEvent(() => {
    if (isDirty) return;
    const persistedGlobalSettings = loadPersistedGlobal();
    setBaseline(persistedGlobalSettings);
    setData(persistedGlobalSettings);
    clearSaved();
  });

  useEffect(() => {
    const sync = (): void => {
      syncFromPersisted();
    };
    window.addEventListener("local-database-update", sync);
    return () => window.removeEventListener("local-database-update", sync);
  }, []);

  useEffect(() => {
    previewGlobalSettings(previewGlobalSettingsDraft(data));
    applyDocumentLanguage(data.language);
  }, [data]);

  const applyPersisted = (globalSettings: GlobalSettings): void => {
    const merged = mergeGlobalSettings(globalSettings);
    setBaseline(merged);
    setData(merged);
    clearGlobalSettingsPreview();
    clearSaved();
  };

  const upd = <K extends keyof GlobalSettings>(field: K, value: GlobalSettings[K]): void => {
    setData((current) => ({ ...current, [field]: value }));
    clearSaved();
  };

  const handleSaveGlobal = async (toast?: UseGlobalSettingsDraftSaveToast): Promise<boolean> => {
    if (!isValidTimeZone(data.timezone)) {
      notify.error(t("global.invalidTimezone"));
      return false;
    }
    if (!parseSessionTimeoutMinutes(normalizeSessionTimeout(data.sessionTimeout))) {
      notify.error(t("global.invalidSessionTimeout"));
      return false;
    }
    if (!["basic", "medium", "strong"].includes(normalizePasswordPolicy(data.passwordPolicy))) {
      notify.error(t("global.invalidPasswordPolicy"));
      return false;
    }
    setSaving(true);
    try {
      const persisted = mergeGlobalSettingsDraft(data);
      const result = await saveGlobalSettingsAsync(persisted);
      if (!result.ok) {
        notify.error(t("settings.serverSaveFailed"), {
          description: t(serverSyncErrorKey(result.status)),
        });
        return false;
      }
      const nextData = retainModulesDraftAfterGlobalSave(persisted, data);
      setBaseline(persisted);
      setData(nextData);
      clearGlobalSettingsPreview();
      applyDocumentLanguage(persisted.language);
      flashSaved();
      notify.success(toast?.saveSuccessMessage ?? t("global.savedToast"), {
        description: toast?.saveSuccessDescription ?? t("global.savedToastDesc"),
      });
      return true;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveModules = async (toast?: UseGlobalSettingsDraftSaveToast): Promise<boolean> => {
    setSaving(true);
    try {
      const persisted = mergeGlobalSettings({
        ...getGlobalSettings(),
        enabledModules: normalizeEnabledModules(data.enabledModules),
      });
      const result = await saveGlobalSettingsAsync(persisted);
      if (!result.ok) {
        notify.error(t("settings.serverSaveFailed"), {
          description: t(serverSyncErrorKey(result.status)),
        });
        return false;
      }
      const nextData = retainGlobalDraftAfterModulesSave(persisted, data);
      setBaseline(persisted);
      setData(nextData);
      clearGlobalSettingsPreview();
      void queryClient.invalidateQueries({ queryKey: MODULE_ACCESS_QUERY_KEY });
      flashSaved();
      notify.success(toast?.saveSuccessMessage ?? t("module.system.saved"), {
        description: toast?.saveSuccessDescription ?? t("module.system.savedDesc"),
      });
      return true;
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardGlobal = (): void => {
    setData((current) => ({
      ...current,
      language: baseline.language,
      timezone: baseline.timezone,
      dateFormat: baseline.dateFormat,
      emailNotifications: baseline.emailNotifications,
      smsNotifications: baseline.smsNotifications,
      whatsAppNotifications: baseline.whatsAppNotifications,
      twoFactor: baseline.twoFactor,
      sessionTimeout: baseline.sessionTimeout,
      passwordPolicy: baseline.passwordPolicy,
    }));
    clearSaved();
  };

  const handleDiscardModules = (): void => {
    setData((current) => ({
      ...current,
      enabledModules: baseline.enabledModules,
    }));
    clearSaved();
  };

  return {
    data,
    baseline,
    isGlobalDirty,
    isModulesDirty,
    saved,
    saving,
    upd,
    handleSaveGlobal,
    handleSaveModules,
    handleDiscardGlobal,
    handleDiscardModules,
    applyPersisted,
    clearSaved,
  };
}

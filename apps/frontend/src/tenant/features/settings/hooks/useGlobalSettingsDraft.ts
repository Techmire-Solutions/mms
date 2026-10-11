import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MODULE_ACCESS_QUERY_KEY } from '@/lib/query/moduleAccessQuery';
import {
  mergeGlobalSettings,
  normalizeEnabledModules,
  type GlobalSettings,
} from '@mms/shared';
import { applyDocumentLanguage } from '@/lib/documentLanguage';
import { getGlobalSettings, saveGlobalSettingsAsync } from '@/lib/db';
import { clearGlobalSettingsPreview, previewGlobalSettings } from '@/lib/settingsPreview';
import { serverSyncErrorKey } from '@/lib/serverSyncErrors';
import { notify } from '@/lib/notify';
import { useTranslation } from '@/hooks/useTranslation';
import { useSavedFlash } from '@/tenant/hooks/useSavedFlash';
import {
  isEnabledModulesDraftDirty,
  isGlobalPreferencesDirty,
  mergeGlobalSettingsDraft,
  previewGlobalSettingsDraft,
  retainGlobalDraftAfterModulesSave,
  retainModulesDraftAfterGlobalSave,
} from '@/lib/settingsGlobalDraft';

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

  useEffect(() => {
    const sync = (): void => {
      if (isDirty) return;
      const persistedGlobalSettings = loadPersistedGlobal();
      setBaseline(persistedGlobalSettings);
      setData(persistedGlobalSettings);
      clearSaved();
    };
    window.addEventListener('local-database-update', sync);
    return () => window.removeEventListener('local-database-update', sync);
  }, [clearSaved, isDirty]);

  useEffect(() => {
    previewGlobalSettings(previewGlobalSettingsDraft(data));
    applyDocumentLanguage(data.language);
  }, [data]);

  const applyPersisted = ((globalSettings: GlobalSettings): void => {
    const merged = mergeGlobalSettings(globalSettings);
    setBaseline(merged);
    setData(merged);
    clearGlobalSettingsPreview();
    clearSaved();
  });

  const upd = (<K extends keyof GlobalSettings>(field: K, value: GlobalSettings[K]): void => {
    setData((current) => ({ ...current, [field]: value }));
    clearSaved();
  });

  const handleSaveGlobal = (async (toast?: UseGlobalSettingsDraftSaveToast): Promise<boolean> => {
      setSaving(true);
      try {
        const persisted = mergeGlobalSettingsDraft(data);
        const result = await saveGlobalSettingsAsync(persisted);
        if (!result.ok) {
          notify.error(t('settings.serverSaveFailed'), {
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
        notify.success(toast?.saveSuccessMessage ?? t('global.savedToast'), {
          description: toast?.saveSuccessDescription ?? t('global.savedToastDesc'),
        });
        return true;
      } finally {
        setSaving(false);
      }
    });

  const handleSaveModules = (async (toast?: UseGlobalSettingsDraftSaveToast): Promise<boolean> => {
      setSaving(true);
      try {
        const persisted = mergeGlobalSettings({
          ...getGlobalSettings(),
          enabledModules: normalizeEnabledModules(data.enabledModules),
        });
        const result = await saveGlobalSettingsAsync(persisted);
        if (!result.ok) {
          notify.error(t('settings.serverSaveFailed'), {
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
        notify.success(toast?.saveSuccessMessage ?? t('module.system.saved'), {
          description: toast?.saveSuccessDescription ?? t('module.system.savedDesc'),
        });
        return true;
      } finally {
        setSaving(false);
      }
    });

  const handleDiscardGlobal = ((): void => {
    setData((current) => ({
      ...current,
      language: baseline.language,
      timezone: baseline.timezone,
      dateFormat: baseline.dateFormat,
      emailNotifications: baseline.emailNotifications,
      smsNotifications: baseline.smsNotifications,
      twoFactor: baseline.twoFactor,
      sessionTimeout: baseline.sessionTimeout,
      passwordPolicy: baseline.passwordPolicy,
    }));
    clearSaved();
  });

  const handleDiscardModules = ((): void => {
    setData((current) => ({
      ...current,
      enabledModules: baseline.enabledModules,
    }));
    clearSaved();
  });

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

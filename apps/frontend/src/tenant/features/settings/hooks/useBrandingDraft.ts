import { useEffect, useState } from "react";
import { useSavedFlash } from "@/tenant/hooks/useSavedFlash";
import { isBrandingFieldsDirty, mergeBrandingSettings, type BrandingSettings } from "@mms/shared";
import { getBrandingSettings, saveBrandingSettings } from "@/lib/db";
import { clearBrandingSettingsPreview, previewBrandingSettings } from "@/lib/settingsPreview";
import { buildBrandingPreviewPatch } from "@/lib/brandingPreviewPatch";
import {
  mergeBrandingIdentityForSave,
  retainThemeDraftAfterIdentitySave,
  sanitizeBrandingSocialLinks,
  resetBrandingIdentityFields,
} from "@/lib/brandingIdentityDraft";
import { loadBranding } from "@/components/branding/BrandingShared";
import { serverSyncErrorKey } from "@/lib/serverSyncErrors";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";

export interface UseBrandingDraftSaveOptions {
  skipToast?: boolean;
}

export interface UseBrandingDraftSaveToast {
  saveSuccessMessage: string;
  saveSuccessDescription: string;
}

export interface UseBrandingDraftOptions {
  saveSuccessMessage: string;
  saveSuccessDescription: string;
  /** Subset used for dirty flag and live preview (defaults to full record). */
  trackKeys?: readonly (keyof BrandingSettings)[];
}

export interface UseBrandingDraftResult {
  data: BrandingSettings;
  baseline: BrandingSettings;
  isDirty: boolean;
  saved: boolean;
  saving: boolean;
  upd: <K extends keyof BrandingSettings>(field: K, value: BrandingSettings[K]) => void;
  handleSave: (
    toast?: UseBrandingDraftSaveToast,
    options?: UseBrandingDraftSaveOptions,
  ) => Promise<boolean>;
  handleSaveIdentity: (toast?: UseBrandingDraftSaveToast) => Promise<boolean>;
  handleDiscardIdentity: () => void;
  applyPersisted: (brandingSettings: BrandingSettings) => void;
}

function loadPersistedBranding(): BrandingSettings {
  return mergeBrandingSettings(getBrandingSettings());
}

function loadDraftBranding(): BrandingSettings {
  return loadBranding();
}

/**
 * Shared draft state for `/settings/branding` and `/settings/theme` (same DB record).
 * Dirty compares draft to persisted storage; preview overlay keeps unsaved edits across tab switches.
 */
export function useBrandingDraft({
  saveSuccessMessage,
  saveSuccessDescription,
  trackKeys,
}: UseBrandingDraftOptions): UseBrandingDraftResult {
  const { t } = useTranslation();
  const { saved, flashSaved, clearSaved } = useSavedFlash();
  const [baseline, setBaseline] = useState<BrandingSettings>(loadPersistedBranding);
  const [data, setData] = useState<BrandingSettings>(loadDraftBranding);
  const [saving, setSaving] = useState(false);

  const isDirty = (() => {
    if (!trackKeys) {
      return JSON.stringify(data) !== JSON.stringify(baseline);
    }
    return isBrandingFieldsDirty(data, baseline, trackKeys);
  })();

  useEffect(() => {
    const sync = (): void => {
      if (isDirty) return;
      const persistedBranding = loadPersistedBranding();
      setBaseline(persistedBranding);
      setData(persistedBranding);
      clearSaved();
    };
    window.addEventListener("local-database-update", sync);
    return () => window.removeEventListener("local-database-update", sync);
  }, [isDirty, clearSaved]);

  useEffect(() => {
    const merged = mergeBrandingSettings(data);
    previewBrandingSettings(buildBrandingPreviewPatch(merged, trackKeys));
  }, [data, trackKeys]);

  const applyPersisted = (brandingSettings: BrandingSettings): void => {
    const merged = mergeBrandingSettings(brandingSettings);
    setBaseline(merged);
    setData(merged);
    clearBrandingSettingsPreview();
    clearSaved();
  };

  const upd = <K extends keyof BrandingSettings>(field: K, value: BrandingSettings[K]): void => {
    setData((current) => ({ ...current, [field]: value }));
    clearSaved();
  };

  const handleSave = async (
    toast?: UseBrandingDraftSaveToast,
    options?: UseBrandingDraftSaveOptions,
  ): Promise<boolean> => {
    setSaving(true);
    try {
      const cleanedData = sanitizeBrandingSocialLinks(data);
      const merged = mergeBrandingSettings(cleanedData);
      const result = await saveBrandingSettings(merged);
      if (!result.ok) {
        notify.error(t("settings.serverSaveFailed"), {
          description: t(serverSyncErrorKey(result.status)),
        });
        return false;
      }
      setBaseline(merged);
      setData(merged);
      clearBrandingSettingsPreview();
      flashSaved();
      if (!options?.skipToast) {
        notify.success(toast?.saveSuccessMessage ?? saveSuccessMessage, {
          description: toast?.saveSuccessDescription ?? saveSuccessDescription,
        });
      }
      return true;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIdentity = async (toast?: UseBrandingDraftSaveToast): Promise<boolean> => {
    setSaving(true);
    try {
      const cleanedData = sanitizeBrandingSocialLinks(data);
      const persisted = mergeBrandingIdentityForSave(cleanedData, baseline);
      const result = await saveBrandingSettings(persisted);
      if (!result.ok) {
        notify.error(t("settings.serverSaveFailed"), {
          description: t(serverSyncErrorKey(result.status)),
        });
        return false;
      }
      const nextData = retainThemeDraftAfterIdentitySave(persisted, cleanedData);
      setBaseline(persisted);
      setData(nextData);
      previewBrandingSettings(buildBrandingPreviewPatch(nextData, trackKeys));
      flashSaved();
      notify.success(toast?.saveSuccessMessage ?? saveSuccessMessage, {
        description: toast?.saveSuccessDescription ?? saveSuccessDescription,
      });
      return true;
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardIdentity = (): void => {
    setData((current) => resetBrandingIdentityFields(current, baseline));
    clearSaved();
  };

  return {
    data,
    baseline,
    isDirty,
    saved,
    saving,
    upd,
    handleSave,
    handleSaveIdentity,
    handleDiscardIdentity,
    applyPersisted,
  };
}

import { useEffect, useEffectEvent, useState } from "react";
import { useSavedFlash } from "@mms/fe-core/hooks/useSavedFlash";
import {
  BRANDING_IDENTITY_FIELD_KEYS,
  BRANDING_THEME_FIELD_KEYS,
  isBrandingFieldsDirty,
  mergeBrandingIdentityOverServerBaseline,
  mergeBrandingSettings,
  pickDirtyBrandingFields,
  type BrandingSettings,
} from "@mms/contracts";
import { fetchBrandingFromServer } from "@/lib/brandingHydration";
import { getBrandingSettings, saveBrandingSettings } from "@/lib/db";
import {
  clearBrandingSettingsPreview,
  previewBrandingSettings,
} from "@mms/fe-core/lib/settingsPreview";
import { buildBrandingPreviewPatch } from "@/lib/brandingPreviewPatch";
import {
  retainIdentityDraftAfterThemeSave,
  retainThemeDraftAfterIdentitySave,
  sanitizeBrandingSocialLinks,
  resetBrandingIdentityFields,
} from "@/lib/brandingIdentityDraft";
import { loadBranding } from "@/components/branding/BrandingShared";
import { serverSyncErrorKey } from "@mms/fe-core/lib/serverSyncErrors";
import { notify } from "@mms/fe-core/notify";
import { useTranslation } from "@mms/fe-core/i18n";

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
  /** Theme-tab save: persists appearance fields only, never staged institution edits. */
  handleSaveTheme: (toast?: UseBrandingDraftSaveToast) => Promise<boolean>;
  handleDiscardIdentity: () => void;
  applyPersisted: (brandingSettings: BrandingSettings) => void;
}

const ALL_BRANDING_FIELD_KEYS = [
  ...BRANDING_IDENTITY_FIELD_KEYS,
  ...BRANDING_THEME_FIELD_KEYS,
] as const;

/**
 * Fresh server record used as the merge base for a save. Only the fields the user
 * actually changed are overlayed, so untouched values (possibly edited on another
 * device, or never hydrated locally) are preserved. Falls back to the hydrated local
 * baseline when the read fails.
 */
async function resolveServerBaseline(fallback: BrandingSettings): Promise<BrandingSettings> {
  return (await fetchBrandingFromServer()) ?? fallback;
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

  // Effect event: always reads the latest draft/flash state, so the listener
  // below is registered once instead of per render (clearSaved identity churns).
  const syncFromPersisted = useEffectEvent(() => {
    if (isDirty) return;
    const persistedBranding = loadPersistedBranding();
    setBaseline(persistedBranding);
    setData(persistedBranding);
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
      const serverBaseline = await resolveServerBaseline(baseline);
      const merged = mergeBrandingSettings({
        ...serverBaseline,
        ...pickDirtyBrandingFields(cleanedData, baseline, ALL_BRANDING_FIELD_KEYS),
      });
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
      const serverBaseline = await resolveServerBaseline(baseline);
      const persisted = mergeBrandingIdentityOverServerBaseline(
        cleanedData,
        baseline,
        serverBaseline,
      );
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

  const handleSaveTheme = async (toast?: UseBrandingDraftSaveToast): Promise<boolean> => {
    setSaving(true);
    try {
      const cleanedData = sanitizeBrandingSocialLinks(data);
      const serverBaseline = await resolveServerBaseline(baseline);
      const persisted = mergeBrandingSettings({
        ...serverBaseline,
        ...pickDirtyBrandingFields(cleanedData, baseline, BRANDING_THEME_FIELD_KEYS),
      });
      const result = await saveBrandingSettings(persisted);
      if (!result.ok) {
        notify.error(t("settings.serverSaveFailed"), {
          description: t(serverSyncErrorKey(result.status)),
        });
        return false;
      }
      const nextData = retainIdentityDraftAfterThemeSave(persisted, cleanedData);
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
    handleSaveTheme,
    handleDiscardIdentity,
    applyPersisted,
  };
}

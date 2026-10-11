import React, { createContext, useContext } from "react";
import {
  BRANDING_IDENTITY_FIELD_KEYS,
  BRANDING_THEME_FIELD_KEYS,
  isBrandingFieldsDirty,
  type BrandingSettings,
} from "@mms/shared";
import {
  useBrandingDraft,
  type UseBrandingDraftOptions,
  type UseBrandingDraftResult,
} from "@/tenant/features/settings/hooks/useBrandingDraft";

export interface SettingsBrandingDraftContextValue extends UseBrandingDraftResult {
  isIdentityDirty: boolean;
  isThemeFieldsDirty: boolean;
  isDirtyFor: (keys: readonly (keyof BrandingSettings)[]) => boolean;
}

const SettingsBrandingDraftContext = createContext<SettingsBrandingDraftContextValue | null>(null);

/**
 * Shared branding draft for Institution + Theme tabs (same DB record, survives tab switches).
 */
export function SettingsBrandingDraftProvider({
  children,
  ...draftOptions
}: UseBrandingDraftOptions & { children: React.ReactNode }): React.JSX.Element {
  const draft = useBrandingDraft(draftOptions);

  const value = ((): SettingsBrandingDraftContextValue => {
    const isDirtyFor = (keys: readonly (keyof BrandingSettings)[]): boolean =>
      isBrandingFieldsDirty(draft.data, draft.baseline, keys);

    return {
      ...draft,
      isIdentityDirty: isDirtyFor(BRANDING_IDENTITY_FIELD_KEYS),
      isThemeFieldsDirty: isDirtyFor(BRANDING_THEME_FIELD_KEYS),
      isDirtyFor,
    };
  })();

  return (
    <SettingsBrandingDraftContext.Provider value={value}>
      {children}
    </SettingsBrandingDraftContext.Provider>
  );
}

export function useSettingsBrandingDraft(): SettingsBrandingDraftContextValue {
  const settingsBrandingDraft = useContext(SettingsBrandingDraftContext);
  if (!settingsBrandingDraft) {
    throw new Error("useSettingsBrandingDraft must be used within SettingsBrandingDraftProvider");
  }
  return settingsBrandingDraft;
}

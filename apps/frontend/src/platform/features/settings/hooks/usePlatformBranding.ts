import { useSyncExternalStore } from "react";
import { mergeBrandingSettings, type BrandingSettings } from "@mms/shared";
import {
  getPlatformBrandingState,
  subscribePlatformBranding,
} from "@/lib/branding/platformBrandingStore";

export interface PlatformBrandingView {
  branding: BrandingSettings;
  productName: string;
  consoleTitle: string;
  logoUrl: string;
  faviconUrl: string;
}

/** Reactive platform branding (white-label) for apex shell/auth components. */
export function usePlatformBranding(): PlatformBrandingView {
  const state = useSyncExternalStore(
    subscribePlatformBranding,
    getPlatformBrandingState,
    getPlatformBrandingState,
  );
  const branding = mergeBrandingSettings({
    madrasaName: state.branding.productName,
    tagline: state.branding.tagline,
    primaryColor: state.branding.primaryColor,
    secondaryColor: state.branding.secondaryColor,
    cornerStyle: state.branding.cornerStyle,
    logoUrl: state.branding.logoUrl,
    faviconUrl: state.branding.faviconUrl,
    footerText: state.branding.footerText,
  });
  return {
    branding,
    productName: state.branding.productName.trim(),
    consoleTitle: state.branding.consoleTitle.trim(),
    logoUrl: state.branding.logoUrl.trim(),
    faviconUrl: state.branding.faviconUrl.trim(),
  };
}

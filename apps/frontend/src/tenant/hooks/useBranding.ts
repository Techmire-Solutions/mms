import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { type BrandingSettings, type AppTranslationKey } from "@mms/shared";
import { applyAppTheme } from "@/lib/brandingTheme";
import { getScopedBrandingSettings } from "@/lib/settingsPreviewStore";
import { SETTINGS_PREVIEW_EVENT } from "@/lib/settingsPreview";
import { isTenantHost } from "@/platform/lib/themeScope";
import { ROUTES, isEntryPath } from "@/lib/config/routes";
import { useTranslation } from "@/hooks/useTranslation";
import { applyPlatformDocumentFavicon, applyTenantDocumentFavicon } from "@/lib/documentFavicon";

/**
 * Custom React hook to load and track real-time changes to the institution's branding settings.
 *
 * @returns {BrandingSettings} The active branding settings object.
 */
export function useBranding(): BrandingSettings {
  const [branding, setBranding] = useState<BrandingSettings>(() => getScopedBrandingSettings());
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    const handleUpdate = (): void => {
      setBranding(getScopedBrandingSettings());
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

  useEffect(() => {
    applyAppTheme();
  }, [
    branding.primaryColor,
    branding.secondaryColor,
    branding.cornerStyle,
    branding.logoUrl,
    branding.faviconUrl,
  ]);

  useEffect(() => {
    const pathname = location.pathname;
    if (isEntryPath(pathname, { isApex: !isTenantHost() })) {
      return;
    }
    if (!isTenantHost()) {
      document.title = "Madrasa Management System";
      applyPlatformDocumentFavicon();
      return;
    }

    let pageLabel = "";
    if (pathname === "/" || pathname === "") {
      pageLabel = t("nav.dashboard");
    } else {
      const matchedKey = Object.keys(ROUTES).find(
        (key) => ROUTES[key as keyof typeof ROUTES] === pathname,
      );
      if (matchedKey) {
        if (matchedKey === "hasanatCards") {
          pageLabel = t("nav.hasanatCards");
        } else if (matchedKey === "questionBank") {
          pageLabel = t("nav.questionBank");
        } else {
          pageLabel = t(`nav.${matchedKey}` as AppTranslationKey);
        }
      }
    }

    if (branding.madrasaName) {
      document.title = pageLabel
        ? `${pageLabel} | ${branding.madrasaName}`
        : `${branding.madrasaName} - ${t("entry.productName")}`;
    }

    applyTenantDocumentFavicon({
      faviconUrl: branding.faviconUrl,
      logoUrl: branding.logoUrl,
      madrasaName: branding.madrasaName,
      primaryColor: branding.primaryColor,
    });
  }, [location.pathname, branding, t]);

  return branding;
}

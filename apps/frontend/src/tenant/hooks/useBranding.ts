import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { type BrandingSettings, type AppTranslationKey } from "@mms/shared";
import { applyAppTheme } from "@/lib/brandingTheme";
import { getScopedBrandingSettings } from "@/lib/settingsPreviewStore";
import { SETTINGS_PREVIEW_EVENT } from "@/lib/settingsPreview";
import { subscribePlatformBranding } from "@/lib/branding/platformBrandingStore";
import { isTenantHost } from "@/lib/config/tenantConfig";
import { ROUTES, isEntryPath } from "@/lib/config/routes";
import { useTranslation } from "@/hooks/useTranslation";
import { applyPlatformDocumentFavicon, applyTenantDocumentFavicon } from "@/lib/documentFavicon";

interface BrandingSnapshot {
  /** Serialized payload used to detect changes; the merged object is rebuilt per change. */
  raw: string;
  value: BrandingSettings;
}

/**
 * `getScopedBrandingSettings` rebuilds a merged object on every call, so the
 * snapshot is memoized by its serialized payload to satisfy `getSnapshot`'s
 * stable-identity contract.
 */
let cachedSnapshot: BrandingSnapshot | null = null;

function subscribeToBrandingUpdates(onStoreChange: () => void): () => void {
  const handleUpdate = (): void => onStoreChange();
  window.addEventListener("local-database-update", handleUpdate);
  window.addEventListener("storage", handleUpdate);
  window.addEventListener(SETTINGS_PREVIEW_EVENT, handleUpdate);
  const unsubscribePlatform = subscribePlatformBranding(handleUpdate);
  return () => {
    window.removeEventListener("local-database-update", handleUpdate);
    window.removeEventListener("storage", handleUpdate);
    window.removeEventListener(SETTINGS_PREVIEW_EVENT, handleUpdate);
    unsubscribePlatform();
  };
}

function getBrandingSnapshot(): BrandingSettings {
  const next = getScopedBrandingSettings();
  const raw = JSON.stringify(next);
  if (cachedSnapshot && cachedSnapshot.raw === raw) return cachedSnapshot.value;
  cachedSnapshot = { raw, value: next };
  return next;
}

/**
 * Custom React hook to load and track real-time changes to the institution's branding settings.
 *
 * @returns {BrandingSettings} The active branding settings object.
 */
export function useBranding(): BrandingSettings {
  // `getServerSnapshot` serves SSR renders (renderToStaticMarkup in tests):
  // same memoized snapshot so server and client renders agree.
  const branding = useSyncExternalStore(
    subscribeToBrandingUpdates,
    getBrandingSnapshot,
    getBrandingSnapshot,
  );
  const location = useLocation();
  const { t } = useTranslation();

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

    if (!isTenantHost()) {
      const productName = branding.madrasaName.trim() || t("entry.productName");
      document.title = pageLabel ? `${pageLabel} | ${productName}` : productName;
      applyPlatformDocumentFavicon({
        faviconUrl: branding.faviconUrl,
        logoUrl: branding.logoUrl,
        productName,
        primaryColor: branding.primaryColor,
      });
      return;
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

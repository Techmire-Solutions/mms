import "./bootstrapZodCsp";
import "@/lib/print/registerPrintBranding";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/index.css";
import { getAppDomain } from "@mms/fe-core/config/tenantConfig";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { applyApexPlatformTheme } from "@mms/fe-core/lib/apexPlatformTheme";
import {
  getPlatformBrandingAsBrandingSettings,
  hydratePlatformBranding,
} from "@mms/fe-core/lib/platformBrandingStore";
import { cleanupLegacyServiceWorkers, installChunkLoadRecovery } from "@/lib/chunkLoadRecovery";
import { applyPlatformDocumentFavicon } from "@/lib/documentFavicon";
import { runAfterFirstPaint } from "@/lib/runAfterFirstPaint";

installChunkLoadRecovery();
// Evict any legacy pre-split Service Worker and Workbox caches from the apex origin.
void cleanupLegacyServiceWorkers();

runAfterFirstPaint(() => {
  void import("@mms/fe-core/reporting/clientErrorReporting").then(({ initErrorReporting }) =>
    initErrorReporting(),
  );
});

const APEX_BRANDING_BOOT_TIMEOUT_MS = 900;
function withTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([
    promise.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

async function applyBootChrome(): Promise<void> {
  void getAppDomain();
  await withTimeout(hydratePlatformBranding(), APEX_BRANDING_BOOT_TIMEOUT_MS);
  const branding = getPlatformBrandingAsBrandingSettings();
  applyPlatformDocumentFavicon({
    faviconUrl: branding.faviconUrl,
    logoUrl: branding.logoUrl,
    productName: branding.madrasaName,
    primaryColor: branding.primaryColor,
  });
  applyApexPlatformTheme("en");
}

if (import.meta.env.DEV) {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("The width(-1) and height(-1) of chart should be greater than 0")
    )
      return;
    originalWarn(...args);
  };
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element with ID 'root'.");
const app = (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
async function bootstrap(): Promise<void> {
  try {
    await applyBootChrome();
  } catch {
    applyPlatformDocumentFavicon();
    applyApexPlatformTheme("en");
  }
  ReactDOM.createRoot(rootElement as HTMLElement).render(
    import.meta.env.DEV ? <React.StrictMode>{app}</React.StrictMode> : app,
  );
}
void bootstrap();

import "./bootstrapZodCsp";
import "@/lib/print/registerPrintBranding";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/index.css";
import { getAppDomain } from "@mms/fe-core/config/tenantConfig";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { installChunkLoadRecovery } from "@/lib/chunkLoadRecovery";
import { runAfterFirstPaint } from "@/lib/runAfterFirstPaint";

installChunkLoadRecovery();
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
  const [{ hydratePlatformBranding, getPlatformBrandingAsBrandingSettings }, favicon] =
    await Promise.all([
      import("@mms/fe-core/lib/platformBrandingStore"),
      import("@/lib/documentFavicon"),
    ]);
  await withTimeout(hydratePlatformBranding(), APEX_BRANDING_BOOT_TIMEOUT_MS);
  const branding = getPlatformBrandingAsBrandingSettings();
  favicon.applyPlatformDocumentFavicon({
    faviconUrl: branding.faviconUrl,
    logoUrl: branding.logoUrl,
    productName: branding.madrasaName,
    primaryColor: branding.primaryColor,
  });
  const { applyApexPlatformTheme } = await import("@mms/fe-core/lib/apexPlatformTheme");
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
  await applyBootChrome();
  ReactDOM.createRoot(rootElement as HTMLElement).render(
    import.meta.env.DEV ? <React.StrictMode>{app}</React.StrictMode> : app,
  );
}
void bootstrap();

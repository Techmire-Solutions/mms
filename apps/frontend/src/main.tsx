import "./bootstrapZodCsp";
import "@/lib/print/registerPrintBranding";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/index.css";
import { isApexHost } from "@mms/contracts/tenantUtils";
import { getAppDomain } from "@/lib/config/tenantConfig";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { installChunkLoadRecovery } from "@/lib/chunkLoadRecovery";
import { runAfterFirstPaint } from "@/lib/runAfterFirstPaint";

// Hashed chunk names change on every deploy while the PWA service worker keeps
// the tab on the current revision. A lazy route whose chunk vanished after a
// release would otherwise throw straight into the root boundary; reload once
// (throttled) instead. Registered before render so no dynamic import can race it.
installChunkLoadRecovery();

// Error reporting is non-interactive: defer initialization until after first paint
// so Sentry and its network setup do not contend with initial rendering.
runAfterFirstPaint(() => {
  void import("@/lib/clientErrorReporting").then(({ initErrorReporting }) => initErrorReporting());
});

const APEX_BRANDING_BOOT_TIMEOUT_MS = 900;

function withTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([
    promise.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

/**
 * Applies the white-label chrome before React mounts. On the apex, branding is
 * hydrated first (bounded wait) so an installer's logo/name never flashes the
 * default MMS chrome on the sign-in page; tenant hosts keep the fast path.
 */
async function applyBootChrome(): Promise<void> {
  const isApex =
    typeof window !== "undefined" && isApexHost(window.location.hostname, getAppDomain());
  if (isApex) {
    const [{ hydratePlatformBranding, getPlatformBrandingAsBrandingSettings }, favicon] =
      await Promise.all([
        import("@/lib/branding/platformBrandingStore"),
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
    const { applyApexPlatformTheme } = await import("@/lib/branding/apexPlatformTheme");
    applyApexPlatformTheme("en");
    return;
  }

  const { applyTenantDocumentFavicon } = await import("@/lib/documentFavicon");
  // Drop the static platform favicon from index.html before React mounts.
  applyTenantDocumentFavicon({});
  const { applyAppTheme } = await import("@/lib/brandingTheme");
  applyAppTheme();
}

// DEV ONLY: suppress the Recharts v3 false-positive dimension warnings that
// fire during mount. The global console must stay unpatched in production —
// a global monkey-patch can silently swallow unrelated warnings.
if (import.meta.env.DEV) {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("The width(-1) and height(-1) of chart should be greater than 0")
    ) {
      return;
    }
    originalWarn(...args);
  };
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element with ID 'root'.");
}

const app = (
  // Root boundary: the local (Sentry-free) ErrorBoundary — the previous
  // Sentry.ErrorBoundary here is what forced @sentry/react into the eager
  // graph. Error reporting still happens via ErrorBoundary's
  // reportClientError hook once the lazy core has initialized.
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

async function bootstrap(): Promise<void> {
  await applyBootChrome();
  ReactDOM.createRoot(rootElement as HTMLElement).render(
    import.meta.env.DEV ? <React.StrictMode>{app}</React.StrictMode> : app,
  );

  // Register service worker deferred after first paint instead of eager injectRegister
  void import("@/lib/registerServiceWorkerDeferred").then(({ registerServiceWorkerDeferred }) => {
    registerServiceWorkerDeferred();
  });
}

void bootstrap();

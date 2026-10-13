import "./bootstrapZodCsp";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/index.css";
import { isApexHost } from "@mms/shared/tenantUtils";
import { getAppDomain } from "@/lib/config/tenantConfig";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";

// Error reporting is non-interactive: initialize it without blocking first
// paint. The Sentry SDK (~170KB) now lives behind the lazy
// clientErrorReporting -> clientErrorReportingCore dynamic-import boundary.
void import("@/lib/clientErrorReporting").then(({ initErrorReporting }) => initErrorReporting());

void import("@/lib/documentFavicon").then(
  ({ applyPlatformDocumentFavicon, applyTenantDocumentFavicon }) => {
    if (typeof window !== "undefined" && isApexHost(window.location.hostname, getAppDomain())) {
      applyPlatformDocumentFavicon();
      void import("@/lib/branding/apexPlatformTheme").then(({ applyApexPlatformTheme }) => {
        applyApexPlatformTheme("en");
      });
    } else {
      // Drop the static platform favicon from index.html before React mounts.
      applyTenantDocumentFavicon({});
      void import("@/lib/brandingTheme").then(({ applyAppTheme }) => applyAppTheme());
    }
  },
);

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

ReactDOM.createRoot(rootElement).render(
  import.meta.env.DEV ? <React.StrictMode>{app}</React.StrictMode> : app,
);

// The service worker is registered by vite-plugin-pwa (`injectRegister: 'auto'`,
// which injects `/registerSW.js`). Do not register it a second time here.

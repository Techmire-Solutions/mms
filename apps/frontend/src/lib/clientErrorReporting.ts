/**
 * Client-side error reporting facade — the sync, dependency-free contract
 * used across the app (`initErrorReporting`, `reportClientError`).
 *
 * This module deliberately does NOT import `@sentry/react` statically: the
 * Sentry SDK is ~170KB and error reporting is non-interactive by definition.
 * The actual implementation lives in `clientErrorReportingCore.ts` and is
 * pulled in via dynamic import only when a DSN is configured and reporting
 * is requested. Keep call-site signatures identical — every consumer imports
 * from here, never from the core module or `@sentry/react` directly.
 */

declare global {
  interface Window {
    _MMS_SENTRY_DSN?: string;
  }
}

type CoreModule = typeof import("./clientErrorReportingCore");

let corePromise: Promise<CoreModule> | null = null;

function loadCore(): Promise<CoreModule> {
  corePromise ??= import("./clientErrorReportingCore");
  return corePromise;
}

/**
 * Initializes client-side error reporting using Sentry if the DSN is configured.
 */
export function initErrorReporting(): void {
  const dsn =
    (import.meta.env.VITE_SENTRY_DSN as string | undefined) ||
    (typeof window !== "undefined" ? window._MMS_SENTRY_DSN : undefined);
  if (!dsn) {
    return;
  }

  void loadCore()
    .then((core) => {
      try {
        core.initSentry(dsn);
      } catch (initError) {
        console.error("[MMS] Failed to initialize Sentry:", initError);
      }
    })
    .catch((loadError) => {
      console.error("[MMS] Failed to load error-reporting module:", loadError);
    });
}

/**
 * Client-side error reporting helper.
 * Scrubs tokens and never logs raw passwords.
 */
export function reportClientError(error: unknown, context?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.error("[MMS client error]", error, context);
    return;
  }

  void loadCore()
    .then((core) => core.reportErrorToSentry(error, context))
    .catch(() => {
      // Reporting must never mask the original failure.
    });

  console.error("[MMS]", error instanceof Error ? error.message : String(error));
}

/**
 * Client-side non-fatal warning reporting. Mirrors `reportClientError` but
 * captures at `warning` level so recoverable issues (quota exceeded, corrupt
 * cache, failed background sync) are visible in production without being
 * treated as exceptions.
 */
export function reportClientWarn(error: unknown, context?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.warn("[MMS client warning]", error, context);
    return;
  }

  void loadCore()
    .then((core) => core.reportWarnToSentry(error, context))
    .catch(() => {
      // Reporting must never mask the original failure.
    });

  console.warn("[MMS]", error instanceof Error ? error.message : String(error));
}

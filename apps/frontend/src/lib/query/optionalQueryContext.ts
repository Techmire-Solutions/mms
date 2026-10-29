import { useContext } from "react";
import { QueryClient, QueryClientContext } from "@tanstack/react-query";
import { useOptionalAuth } from "@/lib/contexts/AuthContext";
import type { AuthContextType } from "@/lib/contexts/authContextHelpers";
import { reportClientError } from "@/lib/clientErrorReporting";

/**
 * Provider-tolerant accessors for the shared data layer.
 *
 * Several shared hook factories (`createModuleSetupConfigHooks`,
 * `createModuleLookupsHooks`, the faculty setup hooks) are exercised directly in
 * unit tests without the app's provider tree, so they must not throw when
 * `QueryClientProvider` / `AuthProvider` is absent. Falling back is correct — but
 * a *silent* fallback in production hides a real wiring bug: queries would run
 * on a detached `QueryClient` (never shared, never invalidated) and auth-gated
 * fetches would simply be disabled.
 *
 * These accessors keep the fallback and report the missing provider once per
 * scope. `silent` is enabled for the test build only.
 */

export interface OptionalContextHooksOptions {
  /** Suppresses reporting (unit-test environment). */
  silent?: boolean;
  /** Reporting sink; defaults to `reportClientError`. */
  report?: (error: unknown, context?: Record<string, unknown>) => void;
}

export interface OptionalContextHooks {
  /** Context `QueryClient`, or a shared retry-disabled fallback when absent. */
  useQueryClientOrFallback: () => QueryClient;
  /** Auth context, or `null` when no `AuthProvider` is mounted. */
  useAuthOrNull: () => AuthContextType | null;
}

/** Builds the accessors with an isolated once-per-scope report set. */
export function createOptionalContextHooks(
  options: OptionalContextHooksOptions = {},
): OptionalContextHooks {
  const reported = new Set<string>();
  const report = options.report ?? reportClientError;
  const fallbackQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function reportMissingProviderOnce(
    scope: "query-client" | "auth",
    message: string,
    context: Record<string, unknown> = {},
  ): void {
    if (options.silent === true) return;
    if (reported.has(scope)) return;
    reported.add(scope);
    report(new Error(message), { scope, ...context });
  }

  function useQueryClientOrFallback(): QueryClient {
    const client = useContext(QueryClientContext);
    if (client) return client;
    reportMissingProviderOnce(
      "query-client",
      "useQueryClient: no QueryClientProvider — using a detached fallback client.",
      { hook: "useQueryClientOrFallback" },
    );
    return fallbackQueryClient;
  }

  function useAuthOrNull(): AuthContextType | null {
    const auth = useOptionalAuth();
    if (!auth) {
      reportMissingProviderOnce(
        "auth",
        "useAuth: no AuthProvider — authenticated queries stay disabled.",
        { hook: "useAuthOrNull" },
      );
    }
    return auth;
  }

  return { useQueryClientOrFallback, useAuthOrNull };
}

/**
 * Production accessors. Missing providers are reported in every build except the
 * test build (`vitest.config.ts` sets `MODE=test`), where they are expected.
 */
export const { useQueryClientOrFallback, useAuthOrNull } = createOptionalContextHooks({
  silent: import.meta.env.MODE === "test",
});

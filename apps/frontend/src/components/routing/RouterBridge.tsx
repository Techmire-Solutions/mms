import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { registerAppNavigate, unregisterAppNavigate } from "@/lib/routing/appNavigate";
import { applyApexPlatformTheme } from "@/lib/branding/apexPlatformTheme";
import { revertSettingsPreviews } from "@/lib/settingsPreview";
import { useScrollToTopOnNavigate } from "@/lib/routing/useScrollToTopOnNavigate";
import { useTenant } from "@/lib/contexts/TenantContext";
import { shouldForcePlatformEnglish } from "@/platform/lib/themeScope";

/**
 * Registers React Router navigate for imperative redirects (logout, etc.)
 * and reapplies document theme/language when the host or route scope changes.
 *
 * Note: we deliberately do NOT blanket-cancel in-flight queries on navigation.
 * A global `queryClient.cancelQueries()` here aborted every unrelated request
 * (shell/notifications/session) on each top-level route change. Module queries
 * are keyed per module and bail out on unmount + `gcTime`, so the abort is not
 * needed for correctness.
 */
export default function RouterBridge(): null {
  const navigate = useNavigate();
  const location = useLocation();
  const { isApex, workspace, workspaceLoading, workspaceMissing, workspaceLookupFailed } =
    useTenant();
  useScrollToTopOnNavigate();

  useEffect(() => {
    registerAppNavigate((path, options) => {
      navigate(path, { replace: options?.replace ?? false });
    });
    return unregisterAppNavigate;
  }, [navigate]);

  useEffect(() => {
    if (!location.pathname.startsWith("/settings")) {
      revertSettingsPreviews();
    }
    if (
      shouldForcePlatformEnglish({
        isApex,
        workspaceLoading,
        workspace,
        workspaceLookupFailed,
      }) ||
      workspaceMissing
    ) {
      applyApexPlatformTheme("en");
      return;
    }
    void import("@/lib/brandingTheme").then(({ applyAppTheme }) => {
      applyAppTheme(location.pathname);
    });
  }, [
    location.pathname,
    isApex,
    workspace,
    workspaceLoading,
    workspaceMissing,
    workspaceLookupFailed,
  ]);

  return null;
}

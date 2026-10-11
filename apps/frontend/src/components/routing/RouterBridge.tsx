import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { registerAppNavigate, unregisterAppNavigate } from "@/lib/routing/appNavigate";
import { applyApexPlatformTheme } from "@/platform/lib/brandingEntryTheme";
import { revertSettingsPreviews } from "@/lib/settingsPreview";
import { useScrollToTopOnNavigate } from "@/lib/routing/useScrollToTopOnNavigate";
import { useTenant } from "@/lib/contexts/TenantContext";
import { shouldForcePlatformEnglish } from "@/platform/lib/themeScope";
import { queryClientInstance } from "@/lib/queryClient";

/**
 * Registers React Router navigate for imperative redirects (logout, etc.)
 * and reapplies document theme/language when the host or route scope changes.
 */
export default function RouterBridge(): null {
  const navigate = useNavigate();
  const location = useLocation();
  const { isApex, workspace, workspaceLoading, workspaceMissing, workspaceLookupFailed } =
    useTenant();
  useScrollToTopOnNavigate();

  const previousSegmentRef = useRef<string | null>(null);

  useEffect(() => {
    const currentSegment = location.pathname.split("/").filter(Boolean)[0] ?? "";
    if (previousSegmentRef.current !== null && previousSegmentRef.current !== currentSegment) {
      void queryClientInstance.cancelQueries();
    }
    previousSegmentRef.current = currentSegment;
  }, [location.pathname]);

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

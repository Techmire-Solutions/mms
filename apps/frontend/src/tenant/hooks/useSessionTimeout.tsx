import React from "react";
import { parseSessionTimeoutMinutes, resolveTenantSessionPolicy, translateApp } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import { SessionTimeoutModal } from "@/components/app/SessionTimeoutModal";
import { notify } from "@/lib/notify";

/**
 * Dynamic inactivity timeout for tenant sessions.
 *
 * The idle window comes from the workspace's `sessionTimeout` global setting
 * (enforced server-side); the client shows a countdown warning shortly before the
 * deadline and offers "stay signed in" (sliding extension via `/api/auth/session/extend`).
 *
 * Returns the warning modal (or null) for the layout to render.
 */
export function useSessionTimeout(): React.JSX.Element | null {
  const { isAuthenticated, logout, extendSession, isExtendingSession } = useAuth();
  const settings = useGlobalSettings();
  const language = settings.language;
  const policy = resolveTenantSessionPolicy(parseSessionTimeoutMinutes(settings.sessionTimeout));

  const handleTimeout = (): void => {
    notify.info(translateApp("global.sessionEndedTitle", language), {
      description: translateApp("global.sessionEndedDesc", language),
    });
    logout();
  };

  const { remainingMs, isWarning, reset } = useIdleTimer({
    enabled: isAuthenticated,
    timeoutMs: policy.idleMs,
    warnBeforeMs: policy.warnBeforeMs,
    onTimeout: handleTimeout,
  });

  const handleExtend = (): void => {
    void extendSession().then(
      () => reset(),
      () => reset(), // still relax the client timer even if the extend call fails
    );
  };

  return (
    <SessionTimeoutModal
      open={isWarning}
      remainingMs={remainingMs}
      onExtend={handleExtend}
      onSignOut={handleTimeout}
      busy={isExtendingSession}
    />
  );
}

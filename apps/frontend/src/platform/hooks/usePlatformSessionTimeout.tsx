import React, { useEffect, useState } from "react";
import { resolvePlatformSessionPolicy, type SessionTimeoutPolicy } from "@mms/shared";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import { SessionTimeoutModal } from "@shared/ui";
import { apiContract } from "@/lib/api";

interface PlatformSessionTimeoutOptions {
  enabled: boolean;
  onTimeout: () => void;
  onExtend: () => Promise<void>;
  busy?: boolean;
}

/**
 * Dynamic inactivity timeout for the apex platform console.
 *
 * Fetches the configured policy from `/api/platform/auth/session/policy` (env-driven
 * server-side) and enforces it with a countdown warning + "stay signed in" sliding
 * extension. Returns the warning modal (or null) for the caller to render.
 */
export function usePlatformSessionTimeout({
  enabled,
  onTimeout,
  onExtend,
  busy = false,
}: PlatformSessionTimeoutOptions): React.JSX.Element | null {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState<SessionTimeoutPolicy | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPolicy(null);
      return;
    }
    let active = true;
    apiContract.platform
      .getSessionPolicy({})
      .then((response) => {
        if (active && response.status === 200) setPolicy(response.body as SessionTimeoutPolicy);
      })
      .catch(() => {
        /* keep the last known policy on a transient failure */
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  const resolvedPolicy = policy ?? resolvePlatformSessionPolicy(30);

  const handleTimeout = (): void => {
    notify.info(t("platform.sessionEndedTitle"), {
      description: t("platform.sessionEndedDesc"),
    });
    onTimeout();
  };

  const handleExtend = (): void => {
    void onExtend().then(
      () => reset(),
      () => reset(), // relax the client timer even if the extend call fails
    );
  };

  // Only arm the idle clock once the authoritative policy has loaded.
  const { remainingMs, isWarning, reset } = useIdleTimer({
    enabled: enabled && Boolean(policy),
    timeoutMs: resolvedPolicy.idleMs,
    warnBeforeMs: resolvedPolicy.warnBeforeMs,
    onTimeout: handleTimeout,
  });

  return (
    <SessionTimeoutModal
      open={enabled && isWarning}
      remainingMs={remainingMs}
      onExtend={handleExtend}
      onSignOut={handleTimeout}
      busy={busy}
      title={t("session.timeoutTitle")}
      subtitle={t("session.timeoutDesc")}
      staySignedInLabel={t("session.staySignedIn")}
      signOutNowLabel={t("session.signOutNow")}
      countdownMessage={(sec) => t("session.timeoutCountdown", { seconds: String(sec) })}
    />
  );
}

import React, { useEffect, useState } from "react";
import { resolvePlatformSessionPolicy, type SessionTimeoutPolicy } from "@mms/contracts";
import { notify } from "@/lib/notify";
import { useTranslation } from "@mms/fe-core/i18n";
import { useIdleTimer } from "@mms/fe-core/hooks/useIdleTimer";
import { SessionTimeoutModal } from "@/components/app/SessionTimeoutModal";
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

  // Disabling the watcher drops the cached policy — reset during render.
  const [prevEnabled, setPrevEnabled] = useState(enabled);
  if (prevEnabled !== enabled) {
    setPrevEnabled(enabled);
    if (!enabled) setPolicy(null);
  }

  useEffect(() => {
    if (!enabled) return;
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

  const endSession = (): void => {
    notify.info(t("platform.sessionEndedTitle"), {
      description: t("platform.sessionEndedDesc"),
    });
    onTimeout();
  };

  // The idle deadline must not sign the admin out while a session extension is
  // in flight: the extension's completion re-arms the idle window, so firing
  // here would race the in-flight `/session/extend` and destroy a fresh session.
  const handleTimeout = (): void => {
    if (busy) return;
    endSession();
  };

  // Explicit sign-out from the warning modal always wins, even mid-extension.
  const handleSignOut = (): void => {
    endSession();
  };

  const handleExtend = (): void => {
    if (busy) return; // one extension at a time
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
      onSignOut={handleSignOut}
      busy={busy}
    />
  );
}

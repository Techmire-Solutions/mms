import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PlatformLoginResponse, PlatformUserProfile } from "@mms/shared";
import { normalizePlatformAdminPermissions } from "@mms/shared";
import { apiFetch, apiJson } from "@/lib/apiClient";
import { queryClientInstance } from "@/lib/queryClient";
import { PLATFORM_AUTH_PATHS } from "@/lib/apiClientHelpers";
import { clearPersistedAuthUser } from "@/lib/contexts/authContextHelpers";
import { useTenant } from "@/lib/contexts/TenantContext";
import { PlatformSessionTimeoutWatcher } from "@/platform/components/PlatformSessionTimeoutWatcher";
import type { PlatformAuthContextType, PlatformLoginOutcome } from "./platformAuthTypes";
export type { PlatformAuthContextType, PlatformLoginOutcome } from "./platformAuthTypes";

const normalizeSessionUser = (user: PlatformUserProfile): PlatformUserProfile => ({
  ...user,
  permissions: normalizePlatformAdminPermissions(user.permissions),
});

const PlatformAuthContext = createContext<PlatformAuthContextType | undefined>(undefined);

export const PlatformAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isApex } = useTenant();
  const [platformUser, setPlatformUser] = useState<PlatformUserProfile | null>(null);
  const [isPlatformAuthenticated, setIsPlatformAuthenticated] = useState(false);
  const [isCheckingPlatformAuth, setIsCheckingPlatformAuth] = useState(isApex);
  const [isPlatformLoginSubmitting, setIsPlatformLoginSubmitting] = useState(false);
  const [platformAuthChecked, setPlatformAuthChecked] = useState(!isApex);

  // Tenant hosts never carry a platform session: clear it during render when apex is left.
  const [prevIsApex, setPrevIsApex] = useState(isApex);
  if (prevIsApex !== isApex) {
    setPrevIsApex(isApex);
    if (!isApex) {
      setPlatformUser(null);
      setIsPlatformAuthenticated(false);
      setPlatformAuthChecked(true);
      setIsCheckingPlatformAuth(false);
    }
  }

  const checkPlatformAuth = useCallback(async (): Promise<void> => {
    if (!isApex) return;

    // Always probe cookie session on apex so new tabs, deep links, and
    // post-setup / password-reset flows restore auth without a sessionStorage gate.
    // Logged-out probe returns 200 { user: null } (not 401) to avoid DevTools noise.
    // A failed probe is folded into a null session so every state update happens after
    // the first await (this runs from a mount effect).
    try {
      const platformSession = await apiJson<{ user: PlatformUserProfile | null }>(
        PLATFORM_AUTH_PATHS.me,
      ).catch(() => null);
      if (platformSession?.user) {
        setPlatformUser(normalizeSessionUser(platformSession.user));
        setIsPlatformAuthenticated(true);
      } else {
        setPlatformUser(null);
        setIsPlatformAuthenticated(false);
      }
    } finally {
      setPlatformAuthChecked(true);
      setIsCheckingPlatformAuth(false);
    }
  }, [isApex]);

  const platformLogin = useCallback(
    async (email: string, password: string): Promise<PlatformLoginOutcome> => {
      setIsPlatformLoginSubmitting(true);
      try {
        const res = await apiJson<PlatformLoginResponse>(PLATFORM_AUTH_PATHS.login, {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });

        if (res.requires2FA && res.challengeId) {
          // 2FA is required — do not authenticate until the code is verified.
          return { requires2FA: true, challengeId: res.challengeId, channel: res.channel };
        }

        clearPersistedAuthUser();
        setPlatformUser(normalizeSessionUser(res.user));
        setIsPlatformAuthenticated(true);
        setPlatformAuthChecked(true);
        return { requires2FA: false };
      } catch (error) {
        setPlatformUser(null);
        setIsPlatformAuthenticated(false);
        throw error;
      } finally {
        setIsPlatformLoginSubmitting(false);
      }
    },
    [],
  );

  const platformVerify2FA = useCallback(
    async (challengeId: string, code: string): Promise<void> => {
      setIsPlatformLoginSubmitting(true);
      try {
        const res = await apiJson<{ user: PlatformUserProfile }>(
          PLATFORM_AUTH_PATHS.twoFactorVerify,
          {
            method: "POST",
            body: JSON.stringify({ challengeId, code }),
          },
        );
        clearPersistedAuthUser();
        setPlatformUser(normalizeSessionUser(res.user));
        setIsPlatformAuthenticated(true);
        setPlatformAuthChecked(true);
      } catch (error) {
        setPlatformUser(null);
        setIsPlatformAuthenticated(false);
        throw error;
      } finally {
        setIsPlatformLoginSubmitting(false);
      }
    },
    [],
  );

  const platformResend2FA = useCallback(
    async (challengeId: string): Promise<{ success: boolean }> => {
      const res = await apiJson<{ success: boolean }>(PLATFORM_AUTH_PATHS.twoFactorResend, {
        method: "POST",
        body: JSON.stringify({ challengeId }),
      });
      return res;
    },
    [],
  );

  const [isExtendingPlatformSession, setIsExtendingPlatformSession] = useState(false);
  const extendPlatformSession = useCallback(async (): Promise<void> => {
    if (!isPlatformAuthenticated) return;
    setIsExtendingPlatformSession(true);
    try {
      await apiFetch(PLATFORM_AUTH_PATHS.sessionExtend, { method: "POST" });
    } finally {
      setIsExtendingPlatformSession(false);
    }
  }, [isPlatformAuthenticated]);

  const platformLogout = useCallback(async (): Promise<void> => {
    try {
      await apiFetch(PLATFORM_AUTH_PATHS.logout, { method: "POST" });
    } catch {
      /* clear client session even if logout request fails */
    } finally {
      queryClientInstance.clear();
      clearPersistedAuthUser();
      setPlatformUser(null);
      setIsPlatformAuthenticated(false);
      setPlatformAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    void checkPlatformAuth();
  }, [checkPlatformAuth]);

  const value = useMemo(
    () => ({
      platformUser,
      isPlatformAuthenticated,
      isCheckingPlatformAuth,
      isPlatformLoginSubmitting,
      platformAuthChecked,
      platformLogin,
      platformVerify2FA,
      platformResend2FA,
      extendPlatformSession,
      isExtendingPlatformSession,
      platformLogout,
      checkPlatformAuth,
    }),
    [
      platformUser,
      isPlatformAuthenticated,
      isCheckingPlatformAuth,
      isPlatformLoginSubmitting,
      platformAuthChecked,
      platformLogin,
      platformVerify2FA,
      platformResend2FA,
      extendPlatformSession,
      isExtendingPlatformSession,
      platformLogout,
      checkPlatformAuth,
    ],
  );

  return (
    <PlatformAuthContext.Provider value={value}>
      <PlatformSessionTimeoutWatcher
        enabled={isApex && isPlatformAuthenticated}
        onTimeout={() => void platformLogout()}
        onExtend={extendPlatformSession}
        busy={isExtendingPlatformSession}
      />
      {children}
    </PlatformAuthContext.Provider>
  );
};
export function usePlatformAuth(): PlatformAuthContextType {
  const platformAuth = useContext(PlatformAuthContext);
  if (!platformAuth) {
    throw new Error("usePlatformAuth must be used within PlatformAuthProvider");
  }
  return platformAuth;
}

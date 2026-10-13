import React, { createContext, useState, useContext, useCallback, useRef, useMemo } from "react";
import { clear2FAState } from "@/lib/twoFactor";
import { type User } from "@mms/shared";
import { appNavigate } from "@/lib/routing/appNavigate";
import { ROUTES } from "@/lib/config/routes";
import { apiFetch } from "@/lib/apiClient";
import { AUTH_PATHS } from "@/lib/apiClientHelpers";
import { getWorkspaceLocalStoragePrefix } from "@/lib/dbStorageCore";
import { queryClientInstance } from "@/lib/queryClient";
import type { AuthError } from "@/lib/authErrors";
import {
  clearPersistedAuthUser,
  clearUserScopedCachesOnLogout,
  getPersistedAuthUser,
  persistAuthUser,
  type AuthContextType,
} from "@/lib/contexts/authContextHelpers";
import { useAuthLoginOperations } from "@/lib/contexts/useAuthLoginOperations";
import { useAuthSessionSync } from "@/lib/contexts/useAuthSessionSync";

export type { AuthError } from "@/lib/authErrors";
export type {
  AuthContextType,
  OnboardResult,
  OnboardPayload,
} from "@/lib/contexts/authContextHelpers";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initialUser] = useState<User | null>(() =>
    typeof window !== "undefined" ? getPersistedAuthUser() : null,
  );
  const [user, setUser] = useState<User | null>(initialUser);
  // The HttpOnly cookie session is authoritative. A cached user may avoid a
  // visual identity flash, but it must never grant authenticated UI access.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isLoadingPublicSettings] = useState<boolean>(false);
  const [authError, setAuthError] = useState<AuthError | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [appPublicSettings] = useState<unknown | null>(null);

  const userRef = useRef<User | null>(initialUser);
  userRef.current = user;

  const checkAppState = useCallback(async (_signal?: AbortSignal): Promise<void> => {
    // No-op stub retained for interface backwards-compatibility without extra network latency
  }, []);

  const applyAuthSession = useCallback(async (authUser: User): Promise<void> => {
    void queryClientInstance.activateTenantSession(authUser);
    setUser(authUser);
    setIsAuthenticated(true);
    setAuthChecked(true);
    persistAuthUser(authUser);
  }, []);

  const { checkUserAuth } = useAuthSessionSync({
    setUser,
    setIsAuthenticated,
    setAuthChecked,
    setIsLoadingAuth,
    setAuthError,
    applyAuthSession,
    userRef,
  });

  const {
    login,
    verify2FA,
    resend2FA,
    extendSession,
    isExtendingSession,
    onboard,
    exchangeHandoff,
    requestPasswordOtp,
    verifyPasswordOtp,
    resetPasswordWithOtp,
  } = useAuthLoginOperations({
    setUser,
    setIsAuthenticated,
    setIsLoadingAuth,
    setAuthChecked,
    setAuthError,
    applyAuthSession,
    isAuthenticated,
  });

  const logout = (shouldRedirect = true): void => {
    clear2FAState();

    if (user?.id) {
      clearUserScopedCachesOnLogout(user.id, getWorkspaceLocalStoragePrefix());
    }

    queryClientInstance.clear();
    setIsLoadingAuth(false);
    clearPersistedAuthUser();
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    setAuthChecked(true);

    void apiFetch(AUTH_PATHS.logout, { method: "POST" });

    if (shouldRedirect) {
      appNavigate(ROUTES.login, { replace: true });
    }
  };

  const navigateToLogin = (): void => {
    appNavigate(ROUTES.login, { replace: true });
  };

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      login,
      verify2FA,
      resend2FA,
      logout,
      extendSession,
      isExtendingSession,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
      onboard,
      exchangeHandoff,
      requestPasswordOtp,
      verifyPasswordOtp,
      resetPasswordWithOtp,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- these auth ops include the component-defined `logout` (recreated each render); listing them would rebuild the context value every render and re-render every consumer.
    [
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      resend2FA,
      isExtendingSession,
      checkUserAuth,
      checkAppState,
    ],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const useOptionalAuth = (): AuthContextType | null => {
  return useContext(AuthContext) ?? null;
};

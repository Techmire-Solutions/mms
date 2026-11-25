import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { clear2FAState } from "./twoFactor";
import { type User } from "@mms/contracts";
import { appNavigate } from "../routing/appNavigate";
import { ROUTES } from "../config/routes";
import { apiFetch } from "../api/client";
import { AUTH_PATHS } from "../api/helpers";
import { getWorkspaceLocalStoragePrefix } from "../storage/dbStorageCore";
import { queryClientInstance } from "../query/queryClient";
import { useUiStateStore } from "./useUiStateStore";
import { backgroundJobStorageKey } from "../backgroundJobs/storageKeys";
import { registerBackgroundJobStorageKeyProvider } from "../backgroundJobs/store";
import type { AuthError } from "./authErrors";
import {
  clearPersistedAuthUser,
  clearUserScopedCachesOnLogout,
  getPersistedAuthUser,
  persistAuthUser,
  type AuthContextType,
} from "./authContextHelpers";
import { useAuthLoginOperations } from "./useAuthLoginOperations";
import { useAuthSessionSync } from "./useAuthSessionSync";

export type { AuthError } from "./authErrors";
export type { AuthContextType, OnboardResult, OnboardPayload } from "./authContextHelpers";

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
  // `userRef` is read by the session-expired handler in `useAuthSessionSync`
  // (an event listener, never render). Sync it in an effect: writing a ref during
  // render breaks React Compiler assumptions and is flagged by `react-hooks/refs`.
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // The local background-jobs mirror must follow the signed-in account: scope
  // its storage key by workspace + user so a shared browser never shows one
  // account's jobs (or replays them) under another account.
  useEffect(() => {
    if (user?.id) {
      registerBackgroundJobStorageKeyProvider(() =>
        backgroundJobStorageKey(getWorkspaceLocalStoragePrefix(), user.id),
      );
    }
  }, [user]);

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

  const logout = useCallback(
    (shouldRedirect = true): void => {
      clear2FAState();

      if (user?.id) {
        clearUserScopedCachesOnLogout(user.id, getWorkspaceLocalStoragePrefix());
      }

      queryClientInstance.clear();
      // Preferences live in a module-level store; clearing only Query/localStorage
      // left the previous user's tabs, column layout and read markers visible to
      // the next user of this tab (login/logout are client-side navigations).
      useUiStateStore.getState().reset();
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
    },
    [user],
  );

  const navigateToLogin = useCallback((): void => {
    appNavigate(ROUTES.login, { replace: true });
  }, []);

  // Every auth op is stable by construction (useCallback over state setters /
  // stable deps; `logout` and `extendSession` change identity only when `user`
  // or `isAuthenticated` change — both already listed below). The value therefore
  // rebuilds only when real auth state changes, never on unrelated provider
  // renders, so consumers are not re-rendered for free.
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
    [
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

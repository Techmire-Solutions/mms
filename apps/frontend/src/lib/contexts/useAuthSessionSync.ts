import { useEffect, useCallback } from "react";
import type { User } from "@mms/shared";
import { apiJson, isApiError, SESSION_EXPIRED_EVENT } from "@/lib/apiClient";
import { AUTH_PATHS } from "@/lib/apiClientHelpers";
import { isCurrentHostApex } from "@/lib/config/tenantConfig";
import { getWorkspaceLocalStoragePrefix } from "@/lib/dbStorageCore";
import { queryClientInstance } from "@/lib/queryClient";
import { appNavigate } from "@/lib/routing/appNavigate";
import { isEntryPath, ROUTES } from "@/lib/config/routes";
import { clear2FAState } from "@/lib/twoFactor";
import type { AuthError } from "@/lib/authErrors";
import {
  AUTH_USER_STORAGE_KEY,
  buildConnectionAuthError,
  clearPersistedAuthUser,
  clearUserScopedCachesOnLogout,
  getPersistedAuthUser,
  hasSessionIndicator,
  readUserIdFromStoredAuth,
} from "@/lib/contexts/authContextHelpers";

export interface UseAuthSessionSyncParams {
  setUser: (user: User | null) => void;
  setIsAuthenticated: (val: boolean) => void;
  setAuthChecked: (val: boolean) => void;
  setIsLoadingAuth: (val: boolean) => void;
  setAuthError: (err: AuthError | null) => void;
  applyAuthSession: (user: User) => Promise<void>;
  userRef: React.RefObject<User | null>;
}

export function useAuthSessionSync({
  setUser,
  setIsAuthenticated,
  setAuthChecked,
  setIsLoadingAuth,
  setAuthError,
  applyAuthSession,
  userRef,
}: UseAuthSessionSyncParams) {
  const checkUserAuth = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (isCurrentHostApex()) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setIsLoadingAuth(false);
        return;
      }

      const isEntry =
        typeof window !== "undefined" && isEntryPath(window.location.pathname, { isApex: false });
      const persistedUser = getPersistedAuthUser();
      const hasSessionIndicatorCookie = hasSessionIndicator();

      if (isEntry && !persistedUser && !hasSessionIndicatorCookie) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setIsLoadingAuth(false);
        return;
      }

      const revision = queryClientInstance.sessionRevision;
      const isCurrent = () => !signal?.aborted && revision === queryClientInstance.sessionRevision;
      setIsLoadingAuth(true);
      setAuthChecked(false);
      setAuthError(null);

      const clearRejectedSession = (): void => {
        // The session is genuinely gone: drop the tenant cache and identity.
        queryClientInstance.clear();
        clearPersistedAuthUser();
        setUser(null);
        setIsAuthenticated(false);
      };

      /**
       * A missing access cookie (15-minute TTL) is not a dead session while the refresh cookie
       * (7-day TTL) is still valid. The boot probe is deliberately excluded from `apiClient`'s
       * generic refresh so it cannot loop; recovery is decided here.
       */
      const refreshAndApply = async (): Promise<void> => {
        try {
          const refreshed = await apiJson<{ user: User }>(AUTH_PATHS.refresh, {
            method: "POST",
            signal,
          });
          if (!isCurrent()) return;
          await applyAuthSession(refreshed.user);
        } catch (refreshError) {
          if (!isCurrent()) return;
          if (
            isApiError(refreshError) &&
            (refreshError.status === 401 || refreshError.status === 403)
          ) {
            clearRejectedSession();
            return;
          }
          // Network error, timeout or 5xx — not an invalid session. Keep the persisted identity
          // and (unlike the rejected path) the offline Query cache.
          const fallback = getPersistedAuthUser();
          setUser(fallback);
          setIsAuthenticated(Boolean(fallback));
          if (!fallback) {
            setAuthError(buildConnectionAuthError(refreshError));
          }
        }
      };

      try {
        const probe = await apiJson<{ user: User | null }>(AUTH_PATHS.session, { signal });
        if (!isCurrent()) return;
        if (probe.user) {
          await applyAuthSession(probe.user);
          return;
        }

        // No access session. On an entry route without a persisted identity the visitor is a
        // guest: refresh only when a returning identity (or a protected route) could be restored,
        // so a stale `csrf_token` never turns a login-page visit into a 401.
        const canRefresh = hasSessionIndicatorCookie && (persistedUser !== null || !isEntry);
        if (canRefresh) {
          await refreshAndApply();
          return;
        }
        if (persistedUser) clearRejectedSession();
      } catch (error) {
        if (!isCurrent()) return;
        if (isApiError(error) && (error.status === 401 || error.status === 403)) {
          // An access token was presented but is invalid/revoked. Recover through the refresh
          // cookie when one can exist, otherwise drop the identity.
          const canRefresh = hasSessionIndicatorCookie && (persistedUser !== null || !isEntry);
          if (canRefresh) {
            await refreshAndApply();
          } else {
            clearRejectedSession();
          }
          return;
        }

        // Network error, timeout or 5xx — NOT an invalid session. Clearing the
        // QueryClient here also stopped the IndexedDB persister and deleted the
        // offline cache (`gcTime: 24h`), so a network blip on boot logged the
        // user out AND destroyed the data the cache exists to provide. Fall back
        // to the last persisted identity instead.
        const fallback = getPersistedAuthUser();
        setUser(fallback);
        setIsAuthenticated(Boolean(fallback));
        if (!fallback) {
          setAuthError(buildConnectionAuthError(error));
        }
      } finally {
        if (isCurrent()) {
          setAuthChecked(true);
          setIsLoadingAuth(false);
        }
      }
    },
    [applyAuthSession, setUser, setIsAuthenticated, setAuthChecked, setIsLoadingAuth, setAuthError],
  );

  useEffect(() => {
    const controller = new AbortController();

    void checkUserAuth(controller.signal);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTH_USER_STORAGE_KEY) {
        if (!event.newValue) {
          // Another tab signed out: evict the previous user's scoped caches
          // before clearing the shared cache, matching the logout path.
          const previousUserId = readUserIdFromStoredAuth(event.oldValue);
          if (previousUserId) {
            clearUserScopedCachesOnLogout(previousUserId, getWorkspaceLocalStoragePrefix());
          }
          setUser(null);
          setIsAuthenticated(false);
          setAuthChecked(true);
          queryClientInstance.clear();
        } else {
          queryClientInstance.clear();
          setIsAuthenticated(false);
          void checkUserAuth(controller.signal);
        }
      }
    };

    const handleSessionExpired = (_event: Event) => {
      clear2FAState();
      if (userRef.current?.id) {
        clearUserScopedCachesOnLogout(userRef.current.id, getWorkspaceLocalStoragePrefix());
      }
      queryClientInstance.clear();
      clearPersistedAuthUser();
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
      const isEntry =
        typeof window !== "undefined" && isEntryPath(window.location.pathname, { isApex: false });
      if (!isEntry) {
        appNavigate(ROUTES.login, { replace: true });
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

    return () => {
      controller.abort();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [checkUserAuth, setUser, setIsAuthenticated, setAuthChecked, userRef]);

  return { checkUserAuth };
}

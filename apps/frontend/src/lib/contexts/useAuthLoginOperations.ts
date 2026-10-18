import { useState, useCallback } from "react";
import type { User } from "@mms/shared";
import {
  clear2FAState,
  getPendingChallengeId,
  mark2FAVerified,
  resend2FACode,
  setPendingChallengeId,
} from "@/lib/twoFactor";
import { apiFetch, apiJson, isApiError } from "@/lib/apiClient";
import { AUTH_PATHS } from "@/lib/apiClientHelpers";
import { isAuthErrorType, parseAuthError, type AuthError } from "@/lib/authErrors";
import {
  AuthFailureError,
  buildConnectionAuthError,
  type LoginApiResponse,
  type OnboardPayload,
  type OnboardResult,
} from "@/lib/contexts/authContextHelpers";

export interface UseAuthLoginOperationsParams {
  setUser: (user: User | null) => void;
  setIsAuthenticated: (val: boolean) => void;
  setIsLoadingAuth: (val: boolean) => void;
  setAuthChecked: (val: boolean) => void;
  setAuthError: (err: AuthError | null) => void;
  applyAuthSession: (user: User) => Promise<void>;
  isAuthenticated: boolean;
}

export function useAuthLoginOperations({
  setUser,
  setIsAuthenticated,
  setIsLoadingAuth,
  setAuthChecked,
  setAuthError,
  applyAuthSession,
  isAuthenticated,
}: UseAuthLoginOperationsParams) {
  const [isExtendingSession, setIsExtendingSession] = useState<boolean>(false);

  const login = async (
    email: string,
    password: string,
  ): Promise<{ user: User; requires2FA: boolean; challengeId?: string }> => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const response = await apiFetch(AUTH_PATHS.login, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const authResponse = (await response.json()) as LoginApiResponse;

        if (authResponse.requires2FA && authResponse.challengeId) {
          clear2FAState();
          setPendingChallengeId(authResponse.challengeId);
          setUser(authResponse.user);
          setIsAuthenticated(false);
          setAuthChecked(true);
          return {
            user: authResponse.user,
            requires2FA: true,
            challengeId: authResponse.challengeId,
          };
        }

        await applyAuthSession(authResponse.user);
        mark2FAVerified();
        return { user: authResponse.user, requires2FA: false };
      }

      const errObj = await parseAuthError(response);
      setAuthError(errObj);
      throw new AuthFailureError(errObj);
    } catch (error: unknown) {
      if (error instanceof AuthFailureError) {
        throw error;
      }
      const connectionError = buildConnectionAuthError(error);
      setAuthError(connectionError);
      throw error;
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const verify2FA = async (code: string): Promise<{ user: User }> => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const challengeId = getPendingChallengeId();
      if (!challengeId) {
        throw new Error("No pending 2FA challenge found");
      }
      const response = await apiJson<{ user: User }>(AUTH_PATHS.twoFactorVerify, {
        method: "POST",
        body: JSON.stringify({ challengeId, code }),
      });
      await applyAuthSession(response.user);
      mark2FAVerified();
      return { user: response.user };
    } catch (error) {
      const authErr: AuthError = isApiError(error)
        ? {
            type: isAuthErrorType(error.type) ? error.type : "invalid_credentials",
            message: error.message,
          }
        : buildConnectionAuthError(error);
      setAuthError(authErr);
      throw error;
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const resend2FA = useCallback(async (challengeIdOverride?: string): Promise<boolean> => {
    const challengeId = challengeIdOverride ?? getPendingChallengeId();
    if (!challengeId) return false;
    return resend2FACode(challengeId);
  }, []);

  const extendSession = async (): Promise<void> => {
    if (!isAuthenticated) return;
    setIsExtendingSession(true);
    try {
      await apiFetch(AUTH_PATHS.sessionExtend, { method: "POST" });
    } finally {
      setIsExtendingSession(false);
    }
  };

  const onboard = async (onboardingPayload: OnboardPayload): Promise<OnboardResult> => {
    setAuthError(null);
    return apiJson<OnboardResult>(AUTH_PATHS.onboard, {
      method: "POST",
      body: JSON.stringify(onboardingPayload),
    });
  };

  const exchangeHandoff = async (code: string): Promise<void> => {
    setAuthError(null);
    const authResponse = await apiJson<{ user: User }>(AUTH_PATHS.handoff, {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    await applyAuthSession(authResponse.user);
    mark2FAVerified();
  };

  const requestPasswordOtp = async (email: string): Promise<void> => {
    await apiJson(AUTH_PATHS.forgotPassword, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  };

  const verifyPasswordOtp = async (email: string, code: string): Promise<void> => {
    await apiJson(AUTH_PATHS.forgotPasswordVerify, {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
  };

  const resetPasswordWithOtp = async (
    email: string,
    code: string,
    password: string,
  ): Promise<void> => {
    setAuthError(null);
    const authResponse = await apiJson<{ user: User }>(AUTH_PATHS.forgotPasswordReset, {
      method: "POST",
      body: JSON.stringify({ email, code, password }),
    });
    await applyAuthSession(authResponse.user);
    mark2FAVerified();
  };

  return {
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
  };
}

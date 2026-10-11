import type { AuthError } from "@/lib/authErrors";
import type { IndustryType, TenantLoginResponse, User, Workspace } from "@mms/shared";
import { getCurrentSubdomain, isCurrentHostApex } from "@/lib/config/tenantConfig";
import { reportClientError } from "@/lib/clientErrorReporting";

export class AuthFailureError extends Error {
  constructor(readonly authError: AuthError) {
    super(authError.message);
    this.name = "AuthFailureError";
  }
}

export function clearUserScopedCachesOnLogout(userId: string, prefix: string): void {
  try {
    localStorage.removeItem(`${prefix}messages`);
    localStorage.removeItem(`${prefix}whatsappTemplates_u:${userId}`);
  } catch (cacheClearError) {
    reportClientError(cacheClearError, { context: "auth.clearUserScopedCaches" });
  }
}

export interface OnboardResult {
  user: User;
  workspace: Workspace;
}

export interface OnboardPayload {
  madrasaName: string;
  tagline: string;
  adminName: string;
  email: string;
  password: string;
  /** Platform operator password step-up. */
  currentPassword: string;
  subdomain: string;
  country?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  adminPhone?: string;
  website?: string;
  footerText?: string;
  city?: string;
  region?: string;
  modules?: string[];
  industryType?: IndustryType;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authError: AuthError | null;
  appPublicSettings: unknown | null;
  authChecked: boolean;
  login: (email: string, password: string) => Promise<TenantLoginResponse>;
  verify2FA: (code: string) => Promise<{ user: User }>;
  resend2FA: (challengeId?: string) => Promise<boolean>;
  logout: (shouldRedirect?: boolean) => void;
  /** Sliding-extension: posts to the session extend endpoint so inactivity is reset. */
  extendSession: () => Promise<void>;
  /** True while an extend request is in flight. */
  isExtendingSession: boolean;
  navigateToLogin: () => void;
  checkUserAuth: (signal?: AbortSignal) => Promise<void>;
  checkAppState: (signal?: AbortSignal) => Promise<void>;
  onboard: (onboardingPayload: OnboardPayload) => Promise<OnboardResult>;
  exchangeHandoff: (code: string) => Promise<void>;
  /** Step 1 — request a one-time code (forgot-password or first-time activation). */
  requestPasswordOtp: (email: string) => Promise<void>;
  /** Step 2 — verify the code before showing the new-password fields. */
  verifyPasswordOtp: (email: string, code: string) => Promise<void>;
  /** Step 3 — set the password with the verified code, and sign the user in. */
  resetPasswordWithOtp: (email: string, code: string, password: string) => Promise<void>;
}

export type LoginApiResponse = TenantLoginResponse;

export const AUTH_USER_STORAGE_KEY = "mms_user";

export function buildConnectionAuthError(error: unknown): AuthError {
  const message =
    error instanceof Error ? error.message : "Failed to connect to authentication server";
  return { type: "connection_error", message };
}

export function getPersistedAuthUser(): User | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(AUTH_USER_STORAGE_KEY) : null;
    if (!raw) return null;
    const user = JSON.parse(raw) as User;
    if (!user || typeof user !== "object" || typeof user.id !== "string" || !user.id) {
      return null;
    }

    if (isCurrentHostApex()) {
      return null;
    }

    const currentSubdomain = getCurrentSubdomain();
    if (
      currentSubdomain &&
      user.workspaceSubdomain &&
      user.workspaceSubdomain.toLowerCase() !== currentSubdomain.toLowerCase()
    ) {
      clearPersistedAuthUser();
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export function persistAuthUser(authUser: User): void {
  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(authUser));
}

export function clearPersistedAuthUser(): void {
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

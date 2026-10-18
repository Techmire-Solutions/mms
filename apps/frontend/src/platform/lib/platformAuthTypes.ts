import type { PlatformUserProfile } from "@mms/shared";

export interface PlatformAuthContextType {
  platformUser: PlatformUserProfile | null;
  isPlatformAuthenticated: boolean;
  /** True while probing existing session (`/me`) on boot. */
  isCheckingPlatformAuth: boolean;
  /** True while a sign-in form submission is in flight. */
  isPlatformLoginSubmitting: boolean;
  platformAuthChecked: boolean;
  platformLogin: (email: string, password: string) => Promise<PlatformLoginOutcome>;
  platformVerify2FA: (challengeId: string, code: string) => Promise<void>;
  platformResend2FA: (challengeId: string) => Promise<{ success: boolean }>;
  /** Sliding-extension: posts to the platform session extend endpoint (idle reset). */
  extendPlatformSession: () => Promise<void>;
  /** True while an extend request is in flight. */
  isExtendingPlatformSession: boolean;
  platformLogout: () => Promise<void>;
  checkPlatformAuth: () => Promise<void>;
}

/** Result of a platform login attempt. When 2FA is required, the session is not
 *  established until the code is verified via `platformVerify2FA`. */
export type PlatformLoginOutcome =
  { requires2FA: true; challengeId: string } | { requires2FA: false };

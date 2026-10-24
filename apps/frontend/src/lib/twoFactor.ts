import { apiJson } from "@/lib/apiClient";
import { AUTH_PATHS } from "@/lib/apiClientHelpers";

const CHALLENGE_KEY = "mms_2fa_challenge";
const VERIFIED_KEY = "mms_2fa_verified";

export function getPendingChallengeId(): string | null {
  return sessionStorage.getItem(CHALLENGE_KEY);
}

export function setPendingChallengeId(challengeId: string): void {
  sessionStorage.setItem(CHALLENGE_KEY, challengeId);
}

export function is2FAVerified(): boolean {
  return sessionStorage.getItem(VERIFIED_KEY) === "1";
}

export function mark2FAVerified(): void {
  sessionStorage.setItem(VERIFIED_KEY, "1");
  sessionStorage.removeItem(CHALLENGE_KEY);
}

export function clear2FAState(): void {
  sessionStorage.removeItem(CHALLENGE_KEY);
  sessionStorage.removeItem(VERIFIED_KEY);
}

export function is2FAPending(): boolean {
  return Boolean(getPendingChallengeId()) && !is2FAVerified();
}

export async function resend2FACode(challengeId: string): Promise<boolean> {
  try {
    await apiJson(AUTH_PATHS.twoFactorResend, {
      method: "POST",
      body: JSON.stringify({ challengeId }),
    });
    return true;
  } catch {
    return false;
  }
}

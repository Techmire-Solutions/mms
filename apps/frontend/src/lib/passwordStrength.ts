import { estimatePasswordStrength } from "@mms/shared";

export interface PasswordStrengthResult {
  score: number;
  colorClass: string;
  key:
    | "account.passwordStrengthVeryWeak"
    | "account.passwordStrengthWeak"
    | "account.passwordStrengthMedium"
    | "account.passwordStrengthStrong"
    | "account.passwordStrengthVeryStrong"
    | null;
}

/** Maps the shared entropy estimate to display chrome (colors + i18n keys stay FE-only). */
export function getPasswordStrength(password: string): PasswordStrengthResult {
  const { score } = estimatePasswordStrength(password);
  if (score === 0) return { score: 0, colorClass: "bg-muted", key: null };
  if (score <= 1) {
    return { score, colorClass: "bg-destructive", key: "account.passwordStrengthVeryWeak" };
  }
  if (score === 2) {
    return { score, colorClass: "bg-destructive/80", key: "account.passwordStrengthWeak" };
  }
  if (score === 3) {
    return { score, colorClass: "bg-warning", key: "account.passwordStrengthMedium" };
  }
  if (score === 4) {
    return { score, colorClass: "bg-success/80", key: "account.passwordStrengthStrong" };
  }
  return { score, colorClass: "bg-success", key: "account.passwordStrengthVeryStrong" };
}

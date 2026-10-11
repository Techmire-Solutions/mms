import type { AppTranslationKey } from "./appTranslations.js";
import { PLATFORM_MIN_PASSWORD_LENGTH } from "./platformTypes.js";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalizes a platform email string by trimming whitespace and converting to lowercase. */
export function normalizePlatformEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Checks whether a given string is a valid email address. */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAIL_RE.test(email.trim());
}

/** Validates platform setup email address and returns a translation key if invalid. */
export function validatePlatformSetupEmail(email: string): AppTranslationKey | null {
  const normalized = normalizePlatformEmail(email);
  if (!isValidEmail(normalized)) {
    return "platform.setupInvalidEmail";
  }
  return null;
}

/** Validates platform setup full name and returns a translation key if invalid. */
export function validatePlatformSetupName(name: string): AppTranslationKey | null {
  if (name.trim().length < 2) {
    return "platform.setupInvalidName";
  }
  return null;
}

/** Validates platform setup password length and complexity, returning a translation key if invalid. */
export function validatePlatformSetupPassword(password: string): AppTranslationKey | null {
  if (password.length < PLATFORM_MIN_PASSWORD_LENGTH) {
    return "platform.setupPasswordTooShort";
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "platform.setupPasswordWeak";
  }
  return null;
}

/** Validates password confirmation equality, returning a translation key if passwords do not match. */
export function validatePlatformPasswordMatch(
  password: string,
  confirmPassword: string,
): AppTranslationKey | null {
  if (password !== confirmPassword) {
    return "platform.forgotPasswordMismatch";
  }
  return null;
}

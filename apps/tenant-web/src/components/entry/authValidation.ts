import { isValidEmail } from "@mms/contracts";
import type { TranslationFunction } from "@mms/fe-core/i18n";

export interface SignInFieldErrors {
  email?: string;
  password?: string;
}

/** Shared email validation for sign-in and forgot-password forms. */
export function validateAuthEmail(email: string, t: TranslationFunction): string | undefined {
  const trimmed = email.trim();
  if (!trimmed) return t("auth.emailRequired");
  if (!isValidEmail(trimmed)) return t("auth.emailInvalid");
  return undefined;
}

/** Shared email/password validation for platform and tenant sign-in forms. */
export function validateSignInCredentials(
  email: string,
  password: string,
  t: TranslationFunction,
): SignInFieldErrors {
  const errors: SignInFieldErrors = {};
  const emailError = validateAuthEmail(email, t);
  if (emailError) errors.email = emailError;
  if (!password) {
    errors.password = t("auth.passwordRequired");
  }
  return errors;
}

/** Focus the first invalid auth field after client-side validation fails. */
export function focusAuthField(fieldId: string): void {
  requestAnimationFrame(() => {
    document.getElementById(fieldId)?.focus();
  });
}

export function firstSignInErrorFieldId(
  errors: SignInFieldErrors,
  emailFieldId: string,
  passwordFieldId: string,
): string | null {
  if (errors.email) return emailFieldId;
  if (errors.password) return passwordFieldId;
  return null;
}

import type { AppTranslationKey } from "../i18n/appTranslations.js";

export type PasswordPolicyLevel = "basic" | "medium" | "strong";

/** Coerces stored password policy to a supported level. */
export function normalizePasswordPolicy(value: string | undefined): PasswordPolicyLevel {
  if (value === "basic" || value === "medium" || value === "strong") return value;
  return "strong";
}

/** Human-readable requirements for the active password policy. */
export function getPasswordPolicyHint(policy: string): string {
  switch (policy as PasswordPolicyLevel) {
    case "basic":
      return "At least 6 characters.";
    case "medium":
      return "At least 8 characters with at least one number.";
    case "strong":
      return "At least 12 characters with uppercase, lowercase, number, and symbol.";
    default:
      return getPasswordPolicyHint("strong");
  }
}

export type PasswordPolicyErrorKey = Extract<
  AppTranslationKey,
  | "global.passwordPolicyErrorMin6"
  | "global.passwordPolicyErrorMin8"
  | "global.passwordPolicyErrorNeedNumber"
  | "global.passwordPolicyErrorMin12"
  | "global.passwordPolicyErrorNeedUpper"
  | "global.passwordPolicyErrorNeedLower"
  | "global.passwordPolicyErrorNeedSymbol"
>;

const PASSWORD_POLICY_ERROR_MESSAGES: Record<PasswordPolicyErrorKey, string> = {
  "global.passwordPolicyErrorMin6": "Password must be at least 6 characters.",
  "global.passwordPolicyErrorMin8": "Password must be at least 8 characters.",
  "global.passwordPolicyErrorNeedNumber": "Password must include at least one number.",
  "global.passwordPolicyErrorMin12": "Password must be at least 12 characters.",
  "global.passwordPolicyErrorNeedUpper": "Password must include an uppercase letter.",
  "global.passwordPolicyErrorNeedLower": "Password must include a lowercase letter.",
  "global.passwordPolicyErrorNeedSymbol": "Password must include a symbol.",
};

export interface PasswordPolicyValidation {
  valid: boolean;
  errorKey?: PasswordPolicyErrorKey;
  message: string;
}

/** Validates a password against the configured global policy level. */
export function validatePasswordPolicy(password: string, policy: string): PasswordPolicyValidation {
  const level = (policy as PasswordPolicyLevel) || "strong";

  const fail = (errorKey: PasswordPolicyErrorKey): PasswordPolicyValidation => ({
    valid: false,
    errorKey,
    message: PASSWORD_POLICY_ERROR_MESSAGES[errorKey],
  });

  if (level === "basic") {
    if (password.length < 6) return fail("global.passwordPolicyErrorMin6");
    return { valid: true, message: "" };
  }

  if (level === "medium") {
    if (password.length < 8) return fail("global.passwordPolicyErrorMin8");
    if (!/\d/.test(password)) return fail("global.passwordPolicyErrorNeedNumber");
    return { valid: true, message: "" };
  }

  if (password.length < 12) return fail("global.passwordPolicyErrorMin12");
  if (!/[A-Z]/.test(password)) return fail("global.passwordPolicyErrorNeedUpper");
  if (!/[a-z]/.test(password)) return fail("global.passwordPolicyErrorNeedLower");
  if (!/\d/.test(password)) return fail("global.passwordPolicyErrorNeedNumber");
  if (!/[^A-Za-z0-9]/.test(password)) return fail("global.passwordPolicyErrorNeedSymbol");
  return { valid: true, message: "" };
}

/** Translation key for the active password policy hint in settings UI. */
export function getPasswordPolicyHintKey(policy: string): AppTranslationKey {
  switch (normalizePasswordPolicy(policy)) {
    case "basic":
      return "global.passwordPolicyHintBasic";
    case "medium":
      return "global.passwordPolicyHintMedium";
    default:
      return "global.passwordPolicyHintStrong";
  }
}

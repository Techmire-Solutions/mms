import React from "react";
import {
  PasswordStrengthMeter as SharedPasswordStrengthMeter,
  type PasswordStrengthMeterProps as SharedPasswordStrengthMeterProps,
  type PasswordStrengthCheck,
} from "@shared/ui";
import { getPasswordStrength } from "@/lib/passwordStrength";
import { useTranslation } from "@/hooks/useTranslation";

export interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
  showChecks?: boolean;
}

export { type PasswordStrengthCheck, type SharedPasswordStrengthMeterProps };

/**
 * Password strength meter facade providing app localization and entropy styling.
 * Delegates rendering to @shared/ui PasswordStrengthMeter.
 */
export function PasswordStrengthMeter({
  password,
  className,
  showChecks = false,
}: PasswordStrengthMeterProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (!password) return null;

  const { score, colorClass, key } = getPasswordStrength(password);

  const checks = [
    { label: t("auth.passwordCheckLength"), pass: password.length >= 8 },
    { label: t("auth.passwordCheckUpper"), pass: /[A-Z]/.test(password) },
    { label: t("auth.passwordCheckNumber"), pass: /[0-9]/.test(password) },
    { label: t("auth.passwordCheckSymbol"), pass: /[^A-Za-z0-9]/.test(password) },
  ];

  const strengthLabel = key ? t(key) : t("account.passwordStrengthVeryWeak");

  return (
    <SharedPasswordStrengthMeter
      password={password}
      score={score}
      colorClass={colorClass}
      strengthTitle={t("auth.passwordStrength")}
      strengthLabel={strengthLabel}
      checks={checks}
      showChecks={showChecks}
      className={className}
    />
  );
}

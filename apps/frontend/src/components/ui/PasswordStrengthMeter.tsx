import React from "react";
import { getPasswordStrength } from "@/lib/passwordStrength";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
  showChecks?: boolean;
}

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
    <div className={cn("space-y-2 pt-1", className)} aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground font-medium">{t("auth.passwordStrength")}</span>
        <span className="font-semibold text-xs capitalize">{strengthLabel}</span>
      </div>

      <div
        className="grid grid-cols-5 gap-1.5 h-1.5 rounded-full overflow-hidden bg-muted"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={5}
        aria-label={t("auth.passwordStrength")}
        aria-valuetext={strengthLabel}
      >
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={cn(
              "h-full transition-colors duration-300 motion-reduce:transition-none",
              score >= step ? colorClass : "bg-transparent",
            )}
          />
        ))}
      </div>

      {showChecks ? (
        <div className="grid grid-cols-2 gap-1 pt-1">
          {checks.map((item) => (
            <div
              key={item.label}
              className={cn(
                "flex items-center gap-1.5 text-3xs transition-colors",
                item.pass ? "text-success font-semibold" : "text-muted-foreground",
              )}
            >
              <span>{item.pass ? "✓" : "○"}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

import React from "react";
import { DEFAULT_GLOBAL_SETTINGS, getPasswordPolicyHintKey } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { AuthPasswordField } from "@/components/entry";
import { PasswordStrengthMeter } from "@/components/app/PasswordStrengthMeter";

export interface AdminSetupPasswordFieldsProps {
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
}

export function AdminSetupPasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
}: AdminSetupPasswordFieldsProps): React.JSX.Element {
  const { t } = useTranslation();
  const passwordMismatch = Boolean(confirmPassword) && password !== confirmPassword;

  return (
    <>
      <div className="space-y-1.5">
        <AuthPasswordField
          id="password"
          label={t("onboarding.admin.password")}
          autoComplete="new-password"
          value={password}
          placeholder={t("auth.passwordPlaceholder")}
          onChange={onPasswordChange}
          describedBy="onboarding-password-hint"
        />
        <p id="onboarding-password-hint" className="text-xs leading-relaxed text-muted-foreground">
          {t(getPasswordPolicyHintKey(DEFAULT_GLOBAL_SETTINGS.passwordPolicy))}
        </p>
        <PasswordStrengthMeter password={password} />
      </div>

      <AuthPasswordField
        id="confirmPassword"
        label={t("onboarding.admin.confirmPassword")}
        autoComplete="new-password"
        value={confirmPassword}
        placeholder={t("auth.passwordPlaceholder")}
        onChange={onConfirmPasswordChange}
        error={passwordMismatch ? t("onboarding.admin.passwordMismatch") : undefined}
      />
    </>
  );
}

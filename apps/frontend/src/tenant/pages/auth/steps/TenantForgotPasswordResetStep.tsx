import React from "react";
import { AuthPasswordField, AuthSubmitButton } from "@/components/entry";
import { getPasswordPolicyHintKey } from "@mms/shared";
import { PasswordStrengthMeter } from "@/components/app/PasswordStrengthMeter";
import { useTranslation } from "@/hooks/useTranslation";
import { AuthStepForm } from "./AuthStepForm";

export interface TenantForgotPasswordResetStepProps {
  password: string;
  setPassword: (password: string) => void;
  confirmPassword: string;
  setConfirmPassword: (confirmPassword: string) => void;
  passwordFieldId: string;
  confirmFieldId: string;
  activePolicy: string;
  loading: boolean;
  clearError: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function TenantForgotPasswordResetStep({
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  passwordFieldId,
  confirmFieldId,
  activePolicy,
  loading,
  clearError,
  onSubmit,
}: TenantForgotPasswordResetStepProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AuthStepForm onSubmit={onSubmit} busy={loading}>
      <fieldset disabled={loading} className="m-0 min-w-0 space-y-4 border-0 p-0">
        <div className="space-y-2">
          <AuthPasswordField
            id={passwordFieldId}
            label={t("auth.password")}
            value={password}
            autoComplete="new-password"
            onChange={(value) => {
              setPassword(value);
              clearError();
            }}
          />
          <PasswordStrengthMeter password={password} />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(getPasswordPolicyHintKey(activePolicy))}
          </p>
        </div>
        <AuthPasswordField
          id={confirmFieldId}
          label={t("auth.forgotConfirmPasswordLabel")}
          value={confirmPassword}
          autoComplete="new-password"
          onChange={(value) => {
            setConfirmPassword(value);
            clearError();
          }}
        />
        <AuthSubmitButton
          busy={loading}
          busyLabel={t("auth.settingPassword")}
          label={t("auth.setPassword")}
        />
      </fieldset>
    </AuthStepForm>
  );
}

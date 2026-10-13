import React from "react";
import { AuthBackLink, AuthResendCodeControl, AuthSubmitButton } from "@/components/entry";
import { isOtpComplete, OtpInput } from "@/components/app/OtpInput";
import { ROUTES } from "@/lib/config/routes";
import { useTranslation } from "@/hooks/useTranslation";
import { AuthStepForm } from "./AuthStepForm";

export interface TenantForgotPasswordOtpStepProps {
  code: string[];
  setCode: (code: string[]) => void;
  title: string;
  hasError: boolean;
  loading: boolean;
  resendCountdown: number;
  clearError: () => void;
  onResend: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function TenantForgotPasswordOtpStep({
  code,
  setCode,
  title,
  hasError,
  loading,
  resendCountdown,
  clearError,
  onResend,
  onSubmit,
}: TenantForgotPasswordOtpStepProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AuthStepForm onSubmit={onSubmit} busy={loading}>
      <fieldset disabled={loading} className="m-0 min-w-0 space-y-4 border-0 p-0">
        <OtpInput
          value={code}
          onChange={(next) => {
            setCode(next);
            if (hasError) clearError();
          }}
          ariaLabel={title}
          disabled={loading}
          hasError={hasError}
        />
        <AuthSubmitButton
          busy={loading}
          busyLabel={t("auth.verifying")}
          label={t("auth.verifySignIn")}
          disabled={!isOtpComplete(code)}
          showArrow={false}
        />
        <AuthResendCodeControl
          countdown={resendCountdown}
          onResend={onResend}
          disabled={loading}
          countdownLabel={t("auth.resendCountdown", { seconds: resendCountdown })}
          resendLabel={t("auth.resendCode")}
        />
        <AuthBackLink to={ROUTES.login} label={t("auth.backToSignIn")} />
      </fieldset>
    </AuthStepForm>
  );
}

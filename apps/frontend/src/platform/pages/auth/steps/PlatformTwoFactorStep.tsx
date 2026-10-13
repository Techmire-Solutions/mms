import React from "react";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { OtpInput } from "@/components/app/OtpInput";
import { FieldErrorMessage } from "@/components/app/FormField";
import {
  AuthSubmitButton,
  AuthResendCodeControl,
  AuthBackLink,
} from "@/components/entry/AuthFormControls";
import { AuthStatusBanner } from "@/components/entry/AuthStatusBanner";
import { PlatformAuthForm } from "@/platform/pages/auth/steps/PlatformAuthForm";

export interface PlatformTwoFactorStepProps {
  onSubmit: (event: React.FormEvent) => void;
  isSubmitting: boolean;
  reducedMotion: boolean;
  error: string | null;
  code: string[];
  onCodeChange: (code: string[]) => void;
  codeError?: string;
  isComplete: boolean;
  resendCountdown: number;
  onResend: () => void;
  onBackToCredentials: () => void;
}

export function PlatformTwoFactorStep({
  onSubmit,
  isSubmitting,
  reducedMotion,
  error,
  code,
  onCodeChange,
  codeError,
  isComplete,
  resendCountdown,
  onResend,
  onBackToCredentials,
}: PlatformTwoFactorStepProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <PlatformAuthForm onSubmit={onSubmit} busy={isSubmitting} reducedMotion={reducedMotion}>
      {error ? <AuthStatusBanner message={error} /> : null}

      <fieldset disabled={isSubmitting} className="m-0 min-w-0 space-y-4 border-0 p-0">
        <legend className="sr-only">{t("auth.twoFactorTitle")}</legend>

        <OtpInput
          value={code}
          onChange={onCodeChange}
          ariaLabel={t("auth.twoFactorTitle")}
          disabled={isSubmitting}
          hasError={Boolean(codeError || error)}
        />

        {codeError ? (
          <FieldErrorMessage message={codeError} className="justify-center text-center" />
        ) : null}

        <AuthSubmitButton
          busy={isSubmitting}
          busyLabel={t("platform.twoFactorVerifying")}
          label={t("platform.twoFactorVerify")}
          icon={ShieldCheck}
          disabled={!isComplete}
          showArrow={false}
        />

        <AuthResendCodeControl
          countdown={resendCountdown}
          onResend={onResend}
          disabled={isSubmitting}
          countdownLabel={t("auth.resendCountdown", { seconds: String(resendCountdown) })}
          resendLabel={t("auth.resendCode")}
        />

        <AuthBackLink
          onClick={onBackToCredentials}
          disabled={isSubmitting}
          label={t("auth.backToSignIn")}
        />
      </fieldset>
    </PlatformAuthForm>
  );
}

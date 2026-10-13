import React from "react";
import { ShieldCheck } from "lucide-react";
import PlatformAuthLayout from "@/platform/components/PlatformAuthLayout";
import {
  AuthBackLink,
  AuthPasswordField,
  AuthResendCodeControl,
  AuthStatusBanner,
  AuthSubmitButton,
} from "@/components/entry";
import { OtpInput, isOtpComplete } from "@/components/app/OtpInput";
import { PasswordStrengthMeter } from "@/components/app/PasswordStrengthMeter";
import { ROUTES } from "@/lib/config/routes";
import type { PlatformForgotPasswordController } from "@/platform/pages/auth/usePlatformForgotPasswordController";

interface PlatformForgotPasswordResetStepProps {
  controller: PlatformForgotPasswordController;
}

export function PlatformForgotPasswordResetStep({
  controller,
}: PlatformForgotPasswordResetStepProps): React.JSX.Element {
  const {
    t,
    newPasswordId,
    confirmPasswordId,
    code,
    setCode,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    error,
    setError,
    devHint,
    loading,
    resendCountdown,
    handleReset,
    handleResend,
  } = controller;

  return (
    <PlatformAuthLayout
      title={t("platform.forgotResetTitle")}
      subtitle={t("platform.forgotResetSubtitle")}
    >
      <form
        onSubmit={(event) => void handleReset(event)}
        className="space-y-4 text-start"
        noValidate
        aria-busy={loading}
      >
        <fieldset disabled={loading} className="m-0 min-w-0 space-y-4 border-0 p-0">
          {devHint ? <AuthStatusBanner variant="warning" message={devHint} /> : null}

          <OtpInput
            value={code}
            onChange={(next) => {
              setCode(next);
              if (error) setError(null);
            }}
            ariaLabel={t("platform.forgotEnterCode")}
            disabled={loading}
            hasError={Boolean(error)}
          />

          {error ? <AuthStatusBanner message={error} /> : null}

          <div className="space-y-2">
            <AuthPasswordField
              id={newPasswordId}
              label={t("platform.forgotNewPassword")}
              autoComplete="new-password"
              value={password}
              onChange={(value) => {
                setPassword(value);
                if (error) setError(null);
              }}
            />
            <PasswordStrengthMeter password={password} />
          </div>

          <AuthPasswordField
            id={confirmPasswordId}
            label={t("platform.forgotConfirmPassword")}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value);
              if (error) setError(null);
            }}
          />

          <AuthSubmitButton
            busy={loading}
            busyLabel={t("common.save")}
            label={t("platform.forgotResetPassword")}
            disabled={!isOtpComplete(code)}
            icon={ShieldCheck}
            showArrow={false}
          />

          <AuthResendCodeControl
            countdown={resendCountdown}
            onResend={() => void handleResend()}
            disabled={loading}
            countdownLabel={t("auth.resendCountdown", { seconds: resendCountdown })}
            resendLabel={t("auth.resendCode")}
          />

          <AuthBackLink to={ROUTES.home} label={t("auth.backToSignIn")} />
        </fieldset>
      </form>
    </PlatformAuthLayout>
  );
}

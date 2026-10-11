import React, { useState } from "react";
import PlatformAuthLayout from "@/platform/components/PlatformAuthLayout";
import EntryPageHead, { formatEntryTitle } from "@/components/entry/EntryPageHead";
import { useSignInCredentialsForm } from "@/components/entry/useSignInCredentialsForm";
import { createEmptyOtp, isOtpComplete } from "@/components/ui/OtpInput";
import { useResendCountdown } from "@/hooks/useResendCountdown";
import { usePlatformAuth, type PlatformLoginOutcome } from "@/platform/lib/PlatformAuthContext";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { PlatformCredentialsStep } from "@/platform/pages/auth/steps/PlatformCredentialsStep";
import { PlatformTwoFactorStep } from "@/platform/pages/auth/steps/PlatformTwoFactorStep";

type SignInStep = "credentials" | "twoFactor";

/** Apex-only sign-in for platform super-users who can provision and manage madrasas. */
export default function PlatformSignIn(): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const { platformLogin, platformVerify2FA, platformResend2FA, isPlatformLoginSubmitting } =
    usePlatformAuth();

  const [step, setStep] = useState<SignInStep>("credentials");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState(createEmptyOtp);
  const [codeError, setCodeError] = useState<string | undefined>();
  const [resendCycle, setResendCycle] = useState(0);

  const {
    emailFieldId,
    passwordFieldId,
    email,
    password,
    fieldErrors,
    error,
    setError,
    hasEmail,
    onEmailChange,
    onPasswordChange,
    validate,
  } = useSignInCredentialsForm({
    t,
    emailFieldId: "platform-email",
    passwordFieldId: "platform-password",
  });

  const resendCountdown = useResendCountdown(step === "twoFactor", 30, resendCycle);
  const isComplete = isOtpComplete(code);

  const pageTitle = formatEntryTitle(t("platform.signInTitle"), t("entry.productName"));

  const handleCredentialsSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!validate()) return;
    try {
      const outcome: PlatformLoginOutcome = await platformLogin(email.trim(), password);
      if (outcome.requires2FA) {
        setChallengeId(outcome.challengeId);
        setCode(createEmptyOtp());
        setCodeError(undefined);
        setError(null);
        setResendCycle((c) => c + 1);
        setStep("twoFactor");
      }
    } catch (err) {
      setError(getPlatformErrorMessage(err, t));
    }
  };

  const handleCodeSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (!isComplete) {
      setCodeError(t("auth.otpIncomplete"));
      return;
    }
    setCodeError(undefined);
    try {
      await platformVerify2FA(challengeId, code.join(""));
    } catch (err) {
      setError(getPlatformErrorMessage(err, t));
      setCode(createEmptyOtp());
    }
  };

  const handleResend = async (): Promise<void> => {
    setError(null);
    try {
      await platformResend2FA(challengeId);
      setCode(createEmptyOtp());
      setResendCycle((c) => c + 1);
    } catch (err) {
      setError(getPlatformErrorMessage(err, t));
    }
  };

  const backToCredentials = (): void => {
    setStep("credentials");
    setChallengeId("");
    setCode(createEmptyOtp());
    setCodeError(undefined);
    setError(null);
  };

  const subtitle =
    step === "twoFactor" ? t("platform.twoFactorSubtitle") : t("platform.signInSubtitle");

  return (
    <>
      <EntryPageHead title={pageTitle} description={t("entry.meta.platformSignIn")} />
      <PlatformAuthLayout
        title={step === "twoFactor" ? t("auth.twoFactorTitle") : t("platform.signInTitle")}
        subtitle={subtitle}
      >
        {step === "credentials" ? (
          <PlatformCredentialsStep
            onSubmit={handleCredentialsSubmit}
            isSubmitting={isPlatformLoginSubmitting}
            reducedMotion={reducedMotion}
            error={error}
            emailFieldId={emailFieldId}
            passwordFieldId={passwordFieldId}
            email={email}
            password={password}
            hasEmail={hasEmail}
            fieldErrors={fieldErrors}
            onEmailChange={onEmailChange}
            onPasswordChange={onPasswordChange}
          />
        ) : (
          <PlatformTwoFactorStep
            onSubmit={handleCodeSubmit}
            isSubmitting={isPlatformLoginSubmitting}
            reducedMotion={reducedMotion}
            error={error}
            code={code}
            onCodeChange={(next) => {
              setCode(next);
              if (codeError) setCodeError(undefined);
              if (error) setError(null);
            }}
            codeError={codeError}
            isComplete={isComplete}
            resendCountdown={resendCountdown}
            onResend={() => void handleResend()}
            onBackToCredentials={backToCredentials}
          />
        )}
      </PlatformAuthLayout>
    </>
  );
}

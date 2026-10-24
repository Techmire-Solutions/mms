import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { AuthEmailField } from "@/components/entry/AuthEmailField";
import { AuthPasswordField } from "@/components/entry/AuthPasswordField";
import { AuthSubmitButton } from "@/components/entry/AuthFormControls";
import { AuthStatusBanner } from "@/components/entry/AuthStatusBanner";
import { ROUTES } from "@/lib/config/routes";
import { PlatformAuthForm } from "@/platform/pages/auth/steps/PlatformAuthForm";

export interface PlatformCredentialsStepProps {
  onSubmit: (event: React.FormEvent) => void;
  isSubmitting: boolean;
  reducedMotion: boolean;
  error: string | null;
  emailFieldId: string;
  passwordFieldId: string;
  email: string;
  password: string;
  hasEmail: boolean;
  fieldErrors: { email?: string; password?: string };
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
}

export function PlatformCredentialsStep({
  onSubmit,
  isSubmitting,
  reducedMotion,
  error,
  emailFieldId,
  passwordFieldId,
  email,
  password,
  hasEmail,
  fieldErrors,
  onEmailChange,
  onPasswordChange,
}: PlatformCredentialsStepProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <PlatformAuthForm onSubmit={onSubmit} busy={isSubmitting} reducedMotion={reducedMotion}>
      {error ? <AuthStatusBanner message={error} /> : null}

      <fieldset disabled={isSubmitting} className="m-0 min-w-0 space-y-4 border-0 p-0">
        <legend className="sr-only">{t("platform.signInTitle")}</legend>
        <AuthEmailField
          id={emailFieldId}
          label={t("auth.emailAddress")}
          value={email}
          autoFocus={!hasEmail}
          autoComplete="email"
          placeholder=""
          error={fieldErrors.email}
          onChange={onEmailChange}
        />

        <AuthPasswordField
          id={passwordFieldId}
          label={t("auth.password")}
          value={password}
          autoFocus={hasEmail}
          placeholder=""
          error={fieldErrors.password}
          forgotPasswordTo={ROUTES.platformForgotPassword}
          forgotPasswordLabel={t("auth.forgotPassword")}
          onChange={onPasswordChange}
        />

        <AuthSubmitButton
          busy={isSubmitting}
          busyLabel={t("auth.signingIn")}
          label={t("platform.signIn")}
        />
      </fieldset>
    </PlatformAuthForm>
  );
}

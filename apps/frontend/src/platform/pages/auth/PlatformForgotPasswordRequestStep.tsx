import React from "react";
import PlatformAuthLayout from "@/platform/components/PlatformAuthLayout";
import {
  AuthBackLink,
  AuthEmailField,
  AuthStatusBanner,
  AuthSubmitButton,
} from "@/components/entry";
import { ROUTES } from "@/lib/config/routes";
import type { PlatformForgotPasswordController } from "@/platform/pages/auth/usePlatformForgotPasswordController";

interface PlatformForgotPasswordRequestStepProps {
  controller: PlatformForgotPasswordController;
}

export function PlatformForgotPasswordRequestStep({
  controller,
}: PlatformForgotPasswordRequestStepProps): React.JSX.Element {
  const {
    t,
    emailFieldId,
    email,
    setEmail,
    emailError,
    setEmailError,
    error,
    setError,
    loading,
    handleRequest,
  } = controller;

  return (
    <PlatformAuthLayout title={t("platform.forgotTitle")} subtitle={t("platform.forgotSubtitle")}>
      <form
        onSubmit={(event) => void handleRequest(event)}
        className="space-y-4"
        noValidate
        aria-busy={loading}
      >
        {error ? <AuthStatusBanner message={error} /> : null}

        <fieldset disabled={loading} className="m-0 min-w-0 space-y-4 border-0 p-0">
          <AuthEmailField
            id={emailFieldId}
            label={t("auth.emailAddress")}
            value={email}
            autoFocus
            autoComplete="email"
            placeholder={t("auth.emailPlaceholder")}
            error={emailError}
            onChange={(value) => {
              setEmail(value);
              setEmailError(undefined);
              setError(null);
            }}
          />

          <AuthSubmitButton
            busy={loading}
            busyLabel={t("auth.sendingResetLink")}
            label={t("platform.forgotSendLink")}
          />

          <AuthBackLink to={ROUTES.home} label={t("auth.backToSignIn")} />
        </fieldset>
      </form>
    </PlatformAuthLayout>
  );
}

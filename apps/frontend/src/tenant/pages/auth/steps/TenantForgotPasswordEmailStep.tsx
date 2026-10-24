import React from "react";
import { AuthBackLink, AuthEmailField, AuthSubmitButton } from "@/components/entry";
import { ROUTES } from "@/lib/config/routes";
import { useTranslation } from "@/hooks/useTranslation";
import { AuthStepForm } from "./AuthStepForm";

export interface TenantForgotPasswordEmailStepProps {
  email: string;
  setEmail: (email: string) => void;
  emailFieldId: string;
  loading: boolean;
  clearError: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function TenantForgotPasswordEmailStep({
  email,
  setEmail,
  emailFieldId,
  loading,
  clearError,
  onSubmit,
}: TenantForgotPasswordEmailStepProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AuthStepForm onSubmit={onSubmit} busy={loading}>
      <fieldset disabled={loading} className="m-0 min-w-0 space-y-4 border-0 p-0">
        <AuthEmailField
          id={emailFieldId}
          label={t("auth.emailAddress")}
          value={email}
          autoFocus
          placeholder={t("auth.emailPlaceholder")}
          onChange={(value) => {
            setEmail(value);
            clearError();
          }}
        />
        <AuthSubmitButton
          busy={loading}
          busyLabel={t("auth.sendingResetLink")}
          label={t("auth.sendCode")}
        />
        <AuthBackLink to={ROUTES.login} label={t("auth.backToSignIn")} />
      </fieldset>
    </AuthStepForm>
  );
}

import React, { useId } from "react";
import AuthLayout from "@/tenant/components/AuthLayout";
import { AuthStatusBanner, EntryPageHead, formatEntryTitle } from "@/components/entry";
import { TenantForgotPasswordEmailStep } from "./steps/TenantForgotPasswordEmailStep";
import { TenantForgotPasswordOtpStep } from "./steps/TenantForgotPasswordOtpStep";
import { TenantForgotPasswordResetStep } from "./steps/TenantForgotPasswordResetStep";
import { useForgotPasswordState } from "./hooks/useForgotPasswordState";

export default function ForgotPassword(): React.JSX.Element {
  const formId = useId();
  const emailFieldId = `${formId}-email`;
  const passwordFieldId = `${formId}-password`;
  const confirmFieldId = `${formId}-confirm`;

  const {
    view,
    email,
    setEmail,
    code,
    setCode,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    loading,
    error,
    setError,
    activePolicy,
    resendCountdown,
    handleRequestCode,
    handleResend,
    handleVerifyCode,
    handleSetPassword,
    title,
    subtitle,
    t,
  } = useForgotPasswordState(emailFieldId);

  return (
    <>
      <EntryPageHead
        title={formatEntryTitle(title, t("entry.productName"))}
        description={t("entry.meta.tenantForgot")}
      />
      <AuthLayout title={title} subtitle={subtitle}>
        {error && <AuthStatusBanner message={error} />}

        {view === "email" && (
          <TenantForgotPasswordEmailStep
            email={email}
            setEmail={setEmail}
            emailFieldId={emailFieldId}
            loading={loading}
            clearError={() => setError("")}
            onSubmit={handleRequestCode}
          />
        )}

        {view === "otp" && (
          <TenantForgotPasswordOtpStep
            code={code}
            setCode={setCode}
            title={title}
            hasError={Boolean(error)}
            loading={loading}
            resendCountdown={resendCountdown}
            clearError={() => setError("")}
            onResend={() => void handleResend()}
            onSubmit={handleVerifyCode}
          />
        )}

        {view === "reset" && (
          <TenantForgotPasswordResetStep
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            passwordFieldId={passwordFieldId}
            confirmFieldId={confirmFieldId}
            activePolicy={activePolicy}
            loading={loading}
            clearError={() => setError("")}
            onSubmit={handleSetPassword}
          />
        )}
      </AuthLayout>
    </>
  );
}

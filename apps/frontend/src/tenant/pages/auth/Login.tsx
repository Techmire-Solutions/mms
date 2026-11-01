import React from "react";
import { Link } from "react-router-dom";
import AuthLayout from "@/tenant/components/AuthLayout";
import EntryPageHead, { formatEntryTitle } from "@/components/entry/EntryPageHead";
import { AuthEmailField } from "@/components/entry/AuthEmailField";
import { AuthPasswordField } from "@/components/entry/AuthPasswordField";
import { AuthSubmitButton } from "@/components/entry/AuthFormControls";
import { AuthStatusBanner } from "@/components/entry/AuthStatusBanner";
import { ROUTES } from "@/lib/config/routes";
import { apexUrl } from "@/lib/config/tenantConfig";
import { CheckboxField } from "@/components/ui/checkbox";
import { useTenantLoginController } from "./useTenantLoginController";

export default function Login(): React.ReactElement {
  const {
    emailFieldId,
    passwordFieldId,
    email,
    password,
    fieldErrors,
    error: formError,
    hasEmail: hasRememberedEmail,
    onEmailChange,
    onPasswordChange,
    rememberFieldId,
    rememberMe,
    loading,
    handoffProcessing,
    isBusy,
    location,
    t,
    handleSubmit,
    handleRememberMeChange,
  } = useTenantLoginController();

  const pageTitle = formatEntryTitle(t("auth.signInTitle"), t("entry.productName"));

  return (
    <>
      <EntryPageHead title={pageTitle} description={t("entry.meta.tenantSignIn")} />
      <AuthLayout
        title={t("auth.signInTitle")}
        subtitle={t("auth.signInSubtitle")}
        footer={
          <div className="space-y-2 text-xs text-muted-foreground">
            <div>
              <Link
                to={`${ROUTES.forgotPassword}?activate=1`}
                className="inline-flex min-h-11 items-center font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
              >
                {t("auth.activateAccount")}
              </Link>
            </div>
            <div>
              {t("auth.notYourMadrasa")}{" "}
              <a
                href={apexUrl(ROUTES.home)}
                className="inline-flex min-h-11 items-center font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
              >
                {t("auth.viewAllMadrasaLinks")}
              </a>
            </div>
          </div>
        }
      >
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-4"
          noValidate
          aria-busy={isBusy}
        >
          {handoffProcessing ? (
            <AuthStatusBanner variant="loading" message={t("auth.handoffProcessing")} />
          ) : (location.state as { passwordChanged?: boolean } | null)?.passwordChanged ? (
            <AuthStatusBanner variant="info" message={t("account.passwordChanged")} />
          ) : formError ? (
            <AuthStatusBanner message={formError} />
          ) : null}

          <fieldset disabled={isBusy} className="m-0 min-w-0 space-y-4 border-0 p-0">
            <legend className="sr-only">{t("auth.signInTitle")}</legend>
            <AuthEmailField
              id={emailFieldId}
              label={t("auth.emailAddress")}
              value={email}
              autoFocus={!hasRememberedEmail}
              disabled={isBusy}
              placeholder={t("auth.emailPlaceholder")}
              error={fieldErrors.email}
              onChange={onEmailChange}
            />

            <AuthPasswordField
              id={passwordFieldId}
              label={t("auth.password")}
              value={password}
              autoFocus={hasRememberedEmail}
              disabled={isBusy}
              placeholder={t("auth.passwordPlaceholder")}
              error={fieldErrors.password}
              onChange={onPasswordChange}
            />

            <div className="flex items-center justify-between gap-3 pt-0.5">
              <CheckboxField
                id={rememberFieldId}
                name="rememberMe"
                checked={rememberMe}
                disabled={isBusy}
                onCheckedChange={handleRememberMeChange}
                label={t("auth.rememberMe")}
                labelClassName="text-sm text-muted-foreground"
              />

              <Link
                to={ROUTES.forgotPassword}
                className="inline-flex min-h-11 items-center rounded-md px-1 text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
              >
                {t("auth.forgotPassword")}
              </Link>
            </div>

            <AuthSubmitButton
              busy={loading}
              busyLabel={t("auth.signingIn")}
              label={t("auth.signIn")}
              disabled={handoffProcessing}
            />
          </fieldset>
        </form>
      </AuthLayout>
    </>
  );
}

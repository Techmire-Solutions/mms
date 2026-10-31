import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DEFAULT_GLOBAL_SETTINGS,
  getPasswordPolicyHintKey,
  validatePasswordPolicy,
} from "@mms/shared";
import AuthLayout from "@/tenant/components/AuthLayout";
import {
  AuthPasswordField,
  AuthStatusBanner,
  AuthSubmitButton,
  EntryPageHead,
  formatEntryTitle,
} from "@/components/entry";
import { PasswordStrengthMeter } from "@/components/app/PasswordStrengthMeter";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { ROUTES } from "@/lib/config/routes";
import { useTranslation } from "@/hooks/useTranslation";
import { apiContract } from "@/lib/api";
import { apiContractError } from "@/lib/apiContractError";

/** Stable ids for e2e (onboarding + responsive authenticated bootstrap). */
const CURRENT_PASSWORD_ID = "current-password";
const NEW_PASSWORD_ID = "new-password";
const CONFIRM_PASSWORD_ID = "confirm-password";
const PASSWORD_HINT_ID = "force-password-policy-hint";

export default function ForcePasswordChange(): React.ReactElement {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const settings = useGlobalSettings();
  const navigate = useNavigate();

  const activePolicy = settings.passwordPolicy ?? DEFAULT_GLOBAL_SETTINGS.passwordPolicy;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t("auth.passwordRequired"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("account.passwordMismatch"));
      return;
    }
    const policy = validatePasswordPolicy(newPassword, activePolicy);
    if (!policy.valid) {
      setError(policy.errorKey ? t(policy.errorKey) : policy.message);
      return;
    }

    setBusy(true);
    try {
      const { status, body } = await apiContract.auth.changePassword({
        body: { currentPassword, newPassword },
      });
      if (status !== 200) {
        const fallback =
          (body as { message?: string; error?: string })?.error || t("account.wrongPassword");
        throw apiContractError({ status, body }, fallback);
      }
      logout(false);
      navigate(ROUTES.login, { replace: true, state: { passwordChanged: true } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("account.wrongPassword"));
    } finally {
      setBusy(false);
    }
  };

  const pageTitle = formatEntryTitle(t("account.forcePasswordTitle"), t("entry.productName"));

  return (
    <>
      <EntryPageHead title={pageTitle} description={t("account.forcePasswordBody")} />
      <AuthLayout title={t("account.forcePasswordTitle")}>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-4"
          noValidate
          aria-busy={busy}
        >
          <AuthStatusBanner variant="warning" message={t("account.forcePasswordBody")} />
          {error ? <AuthStatusBanner message={error} /> : null}

          <fieldset disabled={busy} className="m-0 min-w-0 space-y-4 border-0 p-0">
            <AuthPasswordField
              id={CURRENT_PASSWORD_ID}
              label={t("account.currentPassword")}
              autoComplete="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />

            <div className="space-y-2">
              <AuthPasswordField
                id={NEW_PASSWORD_ID}
                label={t("account.newPassword")}
                autoComplete="new-password"
                value={newPassword}
                onChange={setNewPassword}
                describedBy={PASSWORD_HINT_ID}
              />
              <PasswordStrengthMeter password={newPassword} />
              <p id={PASSWORD_HINT_ID} className="text-xs leading-relaxed text-muted-foreground">
                {t(getPasswordPolicyHintKey(activePolicy))}
              </p>
            </div>

            <AuthPasswordField
              id={CONFIRM_PASSWORD_ID}
              label={t("account.confirmPassword")}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />

            <AuthSubmitButton
              busy={busy}
              busyLabel={t("common.loading")}
              label={t("account.forcePasswordSubmit")}
            />
          </fieldset>
        </form>
      </AuthLayout>
    </>
  );
}

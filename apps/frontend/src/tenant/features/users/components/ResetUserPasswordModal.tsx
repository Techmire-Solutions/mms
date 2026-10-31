import { useState } from "react";
import {
  getPasswordPolicyHintKey,
  resetWorkspaceUserPasswordSchema,
  validatePasswordPolicy,
  type SystemUser,
} from "@mms/shared";
import { KeyRound } from "lucide-react";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormField";
import { PasswordInput } from "@/components/app/PasswordInput";
import { Alert } from "@/components/app/Alert";
import { useTranslation } from "@/hooks/useTranslation";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";

interface ResetUserPasswordModalProps {
  user: SystemUser;
  onClose: () => void;
  onReset: (temporaryPassword: string) => Promise<void>;
}

export function ResetUserPasswordModal({
  user,
  onClose,
  onReset,
}: ResetUserPasswordModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const settings = useGlobalSettings();
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async (): Promise<void> => {
    setError("");
    const parsed = resetWorkspaceUserPasswordSchema.safeParse({ temporaryPassword });
    if (!parsed.success) {
      setError(t("users.resetPasswordRequired"));
      return;
    }
    if (temporaryPassword !== confirmation) {
      setError(t("users.resetPasswordMismatch"));
      return;
    }
    const policy = validatePasswordPolicy(temporaryPassword, settings.passwordPolicy);
    if (!policy.valid) {
      setError(policy.errorKey ? t(policy.errorKey) : policy.message);
      return;
    }

    setSubmitting(true);
    try {
      await onReset(temporaryPassword);
      onClose();
    } catch (resetError: unknown) {
      const message = resetError instanceof Error ? resetError.message.trim() : "";
      setError(message || t("users.resetPasswordFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const policyHint = t(getPasswordPolicyHintKey(settings.passwordPolicy));

  return (
    <FormModal
      open
      onClose={onClose}
      title={t("users.resetPasswordTitle")}
      subtitle={t("users.resetPasswordSubtitle", { name: user.name })}
      icon={KeyRound}
      size="sm"
      error={error || undefined}
      cancelLabel={t("users.cancel")}
      saveLabel={submitting ? t("users.resetPasswordSubmitting") : t("users.resetPasswordSubmit")}
      onSave={handleReset}
      saving={submitting}
      saveDisabled={!temporaryPassword || !confirmation}
      formId="reset-user-password-form"
    >
      <form
        id="reset-user-password-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleReset();
        }}
      >
        <Alert
          tone="warning"
          density="compact"
          title={t("users.resetPasswordWarningTitle")}
          description={t("users.resetPasswordWarningDescription")}
        />
        <Field
          id="reset-user-temporary-password"
          label={t("users.resetPasswordTemporaryLabel")}
          hint={policyHint}
          required
        >
          <PasswordInput
            id="reset-user-temporary-password"
            name="temporaryPassword"
            autoComplete="new-password"
            value={temporaryPassword}
            onChange={(event) => {
              setTemporaryPassword(event.target.value);
              if (error) setError("");
            }}
            disabled={submitting}
          />
        </Field>
        <Field
          id="reset-user-confirm-password"
          label={t("users.resetPasswordConfirmLabel")}
          required
        >
          <PasswordInput
            id="reset-user-confirm-password"
            name="confirmTemporaryPassword"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              if (error) setError("");
            }}
            disabled={submitting}
          />
        </Field>
      </form>
    </FormModal>
  );
}

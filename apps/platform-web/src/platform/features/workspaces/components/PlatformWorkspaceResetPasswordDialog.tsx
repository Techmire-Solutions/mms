import React, { useState } from "react";
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/contracts";
import { KeyRound } from "lucide-react";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { useTranslation } from "@mms/fe-core/i18n";
import { useIdentityReset } from "@/lib/forms/useIdentityReset";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";
import { WorkspaceSummary } from "@/platform/features/workspaces/components/WorkspaceSummary";
import { WorkspacePasswordField } from "@/platform/features/workspaces/components/WorkspacePasswordField";
import { CredentialsResultCard, Field, Input } from "@mms/ui";

interface PlatformWorkspaceResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: PlatformWorkspaceRowData | null;
  resetPending: boolean;
  onConfirm: (
    subdomain: string,
    data: { password: string; newPassword?: string },
  ) => Promise<{ newPassword: string; adminEmail: string }>;
}

export function PlatformWorkspaceResetPasswordDialog({
  open,
  onOpenChange,
  workspace,
  resetPending,
  onConfirm,
}: PlatformWorkspaceResetPasswordDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [result, setResult] = useState<{ newPassword: string; adminEmail: string } | null>(null);
  const [error, setError] = useState("");

  // A different workspace target (or a reopen) must not reuse the previous
  // credentials or the previous generated password.
  useIdentityReset(`${open}:${workspace?.subdomain ?? "none"}`, () => {
    setPassword("");
    setCurrentPassword("");
    setResult(null);
    setError("");
  });

  if (!workspace) return null;

  const handleReset = async () => {
    if (resetPending) return;
    if (!currentPassword.trim()) {
      setError(t("platform.validationConfirmPlatformPassword"));
      return;
    }
    if (password && password.length < 8) {
      setError(t("platform.validationPasswordLength"));
      return;
    }
    setError("");
    try {
      const res = await onConfirm(workspace.subdomain, {
        password: currentPassword,
        newPassword: password || undefined,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(getPlatformErrorMessage(err, t, undefined, "platform.loadFailed"));
    }
  };

  const handleClose = () => {
    if (resetPending) return;
    setPassword("");
    setCurrentPassword("");
    setResult(null);
    setError("");
    onOpenChange(false);
  };

  return (
    <FormModal
      open={open}
      onClose={handleClose}
      title={t("platform.resetPasswordTitle")}
      subtitle={t("platform.createAdminSubtitle", {
        name: workspace.madrasaName,
        subdomain: workspace.subdomain,
      })}
      icon={KeyRound}
      size="md"
      error={result ? undefined : error || undefined}
      cancelLabel={result ? undefined : t("common.cancel")}
      saveLabel={result ? t("common.close") : t("platform.resetPasswordBtn")}
      onSave={result ? handleClose : handleReset}
      saving={resetPending}
      formId={result ? undefined : "platform-reset-password-form"}
    >
      {result ? (
        <CredentialsResultCard
          title={t("platform.resetPasswordSuccess")}
          fields={[{ label: t("platform.adminEmailValue"), value: result.adminEmail }]}
          passwordLabel={t("platform.newPasswordValue")}
          password={result.newPassword}
          copyText={result.newPassword}
          copyLabel={t("common.copy")}
          hint={t("platform.sharePasswordHint")}
        />
      ) : (
        <form
          id="platform-reset-password-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleReset();
          }}
          className="space-y-3"
        >
          <WorkspaceSummary workspace={workspace} showAdminEmail />

          <WorkspacePasswordField
            label={t("platform.newPasswordLabel")}
            placeholder={t("platform.newPasswordPlaceholder")}
            value={password}
            onChange={(val) => {
              setPassword(val);
              if (error) setError("");
            }}
            pending={resetPending}
            error={error === t("platform.validationPasswordLength") ? error : undefined}
          />

          <Field
            id={`reset-step-up-${workspace.subdomain}`}
            label={t("platform.confirmPlatformPassword")}
            required
            error={error === t("platform.validationConfirmPlatformPassword") ? error : undefined}
          >
            <Input
              id={`reset-step-up-${workspace.subdomain}`}
              name="platformPassword"
              type="password"
              autoComplete="current-password"
              placeholder={t("platform.confirmPlatformPasswordHint")}
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (error) setError("");
              }}
              className="h-11 text-sm"
              disabled={resetPending}
            />
          </Field>
        </form>
      )}
    </FormModal>
  );
}

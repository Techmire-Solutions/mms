import React, { useState } from "react";
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";
import { KeyRound } from "lucide-react";
import { FormModal } from "@/components/app/FormModal";
import { CredentialsResultCard } from "@/components/app/CredentialsResultCard";
import { useTranslation } from "@/hooks/useTranslation";
import { WorkspaceSummary } from "@/platform/components/workspace/WorkspaceSummary";
import { WorkspacePasswordField } from "@/platform/components/workspace/WorkspacePasswordField";
import { Field } from "@/components/app/FormField";
import { Input } from "@/components/ui/input";

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

  if (!workspace) return null;

  const handleReset = async () => {
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
      setError(err instanceof Error ? err.message : t("platform.loadFailed"));
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
      error={
        result
          ? undefined
          : error &&
              error !== t("platform.validationPasswordLength") &&
              error !== t("platform.validationConfirmPlatformPassword")
            ? error
            : undefined
      }
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

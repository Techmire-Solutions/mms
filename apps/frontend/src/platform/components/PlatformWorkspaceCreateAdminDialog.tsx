import React, { useId, useState } from "react";
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";
import { UserPlus, User, Mail } from "lucide-react";
import { FormModal } from "@/components/app/FormModal";
import { Field, FieldErrorMessage } from "@/components/app/FormField";
import { LeadingIconInput } from "@/components/app/LeadingIconInput";
import { Input } from "@/components/ui/input";
import { WorkspaceSummary } from "@/platform/components/workspace/WorkspaceSummary";
import { WorkspacePasswordField } from "@/platform/components/workspace/WorkspacePasswordField";
import { useTranslation } from "@/hooks/useTranslation";
import { CreateAdminResultCard } from "@/platform/components/workspace/CreateAdminResultCard";

interface PlatformWorkspaceCreateAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: PlatformWorkspaceRowData | null;
  createPending: boolean;
  onConfirm: (
    subdomain: string,
    data: { name: string; email: string; password?: string; currentPassword: string },
  ) => Promise<{ initialPassword: string; adminEmail: string; name: string }>;
}

export function PlatformWorkspaceCreateAdminDialog({
  open,
  onOpenChange,
  workspace,
  createPending,
  onConfirm,
}: PlatformWorkspaceCreateAdminDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const nameId = useId();
  const emailId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [result, setResult] = useState<{
    initialPassword: string;
    adminEmail: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState("");

  if (!workspace) return null;

  const handleCreate = async () => {
    if (!name.trim()) {
      setError(t("platform.validationEnterName"));
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError(t("platform.validationEnterValidEmail"));
      return;
    }
    if (password && password.length < 8) {
      setError(t("platform.validationPasswordLength"));
      return;
    }
    if (!currentPassword.trim()) {
      setError(t("platform.validationConfirmPlatformPassword"));
      return;
    }
    setError("");
    try {
      const res = await onConfirm(workspace.subdomain, {
        name: name.trim(),
        email: email.trim(),
        password: password || undefined,
        currentPassword,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("platform.loadFailed"));
    }
  };

  const handleClose = () => {
    if (createPending) return;
    setName("");
    setEmail("");
    setPassword("");
    setCurrentPassword("");
    setResult(null);
    setError("");
    onOpenChange(false);
  };

  const fieldError =
    error === t("platform.validationEnterName") ||
    error === t("platform.validationEnterValidEmail") ||
    error === t("platform.validationPasswordLength") ||
    error === t("platform.validationConfirmPlatformPassword")
      ? undefined
      : error || undefined;

  return (
    <FormModal
      open={open}
      onClose={handleClose}
      title={t("platform.createAdminUser")}
      subtitle={t("platform.createAdminSubtitle", {
        name: workspace.madrasaName,
        subdomain: workspace.subdomain,
      })}
      icon={UserPlus}
      size="md"
      error={result ? undefined : fieldError}
      cancelLabel={result ? undefined : t("common.cancel")}
      saveLabel={result ? t("common.close") : t("platform.createAdminBtn")}
      onSave={result ? handleClose : handleCreate}
      saving={createPending}
      formId={result ? undefined : "platform-create-admin-form"}
    >
      {result ? (
        <CreateAdminResultCard
          name={result.name}
          adminEmail={result.adminEmail}
          initialPassword={result.initialPassword}
        />
      ) : (
        <form
          id="platform-create-admin-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
          className="space-y-3"
        >
          <WorkspaceSummary workspace={workspace} />

          <Field
            id={nameId}
            label={t("platform.adminNameLabel")}
            required
            error={error === t("platform.validationEnterName") ? error : undefined}
          >
            <LeadingIconInput
              icon={User}
              type="text"
              id={nameId}
              placeholder={t("platform.adminNamePlaceholder")}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              className="h-11 text-sm"
              disabled={createPending}
            />
          </Field>

          <Field
            id={emailId}
            label={t("platform.adminEmailLabel")}
            required
            error={error === t("platform.validationEnterValidEmail") ? error : undefined}
          >
            <LeadingIconInput
              icon={Mail}
              type="email"
              id={emailId}
              placeholder={t("platform.adminEmailPlaceholder")}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              className="h-11 text-sm"
              disabled={createPending}
            />
          </Field>

          <WorkspacePasswordField
            label={t("platform.initialPasswordLabel")}
            placeholder={t("platform.initialPasswordPlaceholder")}
            value={password}
            onChange={(val) => {
              setPassword(val);
              if (error) setError("");
            }}
            pending={createPending}
            error={error === t("platform.validationPasswordLength") ? error : undefined}
          />

          <Field
            id={`create-step-up-${workspace.subdomain}`}
            label={t("platform.confirmPlatformPassword")}
            required
            error={error === t("platform.validationConfirmPlatformPassword") ? error : undefined}
          >
            <Input
              id={`create-step-up-${workspace.subdomain}`}
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
              disabled={createPending}
            />
          </Field>

          {fieldError ? <FieldErrorMessage message={fieldError} /> : null}
        </form>
      )}
    </FormModal>
  );
}

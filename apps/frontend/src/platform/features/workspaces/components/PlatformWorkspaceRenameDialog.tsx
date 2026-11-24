import React, { useId, useState } from "react";
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/contracts";
import { Pencil } from "lucide-react";
import { FormModal } from "@/components/app/FormModal";
import { Field, Input } from "@mms/ui";
import { NAME_MAX } from "@/components/branding/BrandingShared";
import { useTranslation } from "@/hooks/useTranslation";
import { useIdentityReset } from "@/lib/forms/useIdentityReset";
import { useDirtySnapshot } from "@/lib/forms/useDirtySnapshot";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";
import { WorkspaceSummary } from "@/platform/features/workspaces/components/WorkspaceSummary";

interface PlatformWorkspaceRenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: PlatformWorkspaceRowData | null;
  renamePending: boolean;
  onConfirm: (subdomain: string, madrasaName: string) => Promise<void>;
}

/**
 * Platform-only madrasa rename. The name is console-owned: tenant administrators
 * cannot change it from their own console, API or backup restore.
 */
export function PlatformWorkspaceRenameDialog({
  open,
  onOpenChange,
  workspace,
  renamePending,
  onConfirm,
}: PlatformWorkspaceRenameDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const nameId = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const identity = `${open}:${workspace?.subdomain ?? "none"}`;
  const baselineName = workspace?.madrasaName ?? "";

  useIdentityReset(identity, () => {
    setName(baselineName);
    setError("");
  });

  const { isDirty } = useDirtySnapshot({ name }, identity, { name: baselineName });

  if (!workspace) return null;

  const handleClose = () => {
    if (renamePending) return;
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (renamePending) return;
    const nextName = name.trim();
    if (!nextName) {
      setError(t("platform.validationEnterWorkspaceName"));
      return;
    }
    if (nextName === baselineName.trim()) {
      onOpenChange(false);
      return;
    }
    try {
      await onConfirm(workspace.subdomain, nextName);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(getPlatformErrorMessage(err, t, undefined, "platform.renameFailed"));
    }
  };

  return (
    <FormModal
      open={open}
      onClose={handleClose}
      title={t("platform.renameWorkspace")}
      subtitle={t("platform.renameWorkspaceDesc")}
      icon={Pencil}
      size="md"
      error={error || undefined}
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      onSave={handleSave}
      saving={renamePending}
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("common.discardUnsavedDescription")}
      formId="platform-rename-workspace-form"
    >
      <form
        id="platform-rename-workspace-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!renamePending) void handleSave();
        }}
        className="space-y-3"
      >
        <WorkspaceSummary workspace={workspace} showAdminEmail />
        <Field id={nameId} label={t("platform.workspaceNameLabel")} required>
          <Input
            id={nameId}
            name="madrasaName"
            type="text"
            required
            maxLength={NAME_MAX}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError("");
            }}
            placeholder={t("branding.madrasaNamePlaceholder")}
            className="h-11 text-sm"
          />
        </Field>
      </form>
    </FormModal>
  );
}

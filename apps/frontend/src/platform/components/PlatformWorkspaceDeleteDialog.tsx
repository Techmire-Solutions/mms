import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { TypedConfirmDialog } from "@shared/ui";

interface PlatformWorkspaceDeleteDialogProps {
  workspace: PlatformWorkspaceRowData;
  appDomain: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  confirmSubdomain: string;
  onConfirmSubdomainChange: (value: string) => void;
  passwordError: string | null;
  deletePending: boolean;
  onConfirm: () => void;
}

export function PlatformWorkspaceDeleteDialog({
  workspace,
  appDomain,
  open,
  onOpenChange,
  password,
  onPasswordChange,
  confirmSubdomain,
  onConfirmSubdomainChange,
  passwordError,
  deletePending,
  onConfirm,
}: PlatformWorkspaceDeleteDialogProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <TypedConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("platform.deleteWorkspaceTitle")}
      description={t("platform.deleteWorkspaceDesc", {
        name: workspace.madrasaName,
        subdomain: workspace.subdomain,
        domain: appDomain,
      })}
      confirmLabel={t("platform.deleteWorkspaceConfirmSubdomain", {
        subdomain: workspace.subdomain,
      })}
      expectedConfirm={workspace.subdomain}
      confirmValue={confirmSubdomain}
      onConfirmValueChange={onConfirmSubdomainChange}
      confirmInputName="confirmSubdomain"
      password={password}
      onPasswordChange={onPasswordChange}
      passwordInputId={`delete-pw-${workspace.subdomain}`}
      passwordInputName="deleteWorkspacePassword"
      passwordHint={t("platform.deleteWorkspacePasswordHint")}
      error={passwordError}
      pending={deletePending}
      confirmButtonLabel={t("platform.deleteWorkspaceConfirm")}
      confirmVariant="destructive"
      confirmMatch="caseInsensitive"
      onConfirm={onConfirm}
    />
  );
}

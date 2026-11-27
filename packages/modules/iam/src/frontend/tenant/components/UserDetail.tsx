import React, { useState } from "react";
import { Shield } from "lucide-react";
import {
  filterRbacModulesForSettings,
  formatDate,
  resolveWorkspaceRole,
  type SystemUser,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useGlobalSettings } from "../host/useGlobalSettings";
import { useWorkspaceRoles } from "../host/useWorkspaceRoles";
import { DetailDrawerShell } from "@mms/fe-core/components/DetailDrawerShell";
import {
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
} from "@mms/fe-core/components/DetailDrawerArchiveChrome";
import { UserRoleBadge, UserStatusBadge } from "./UserBadges";
import { notify } from "@mms/fe-core/notify";
import { usePermissions } from "../host/usePermissions";
import { useUsersContractVerifyEmail } from "../host/useUsersContractVerifyEmail";
import { UserDetailSections } from "./UserDetailSections";
import { TenantMessageComposerLauncher } from "../host/TenantMessageComposerLauncher";

export interface UserDetailProps {
  user: SystemUser;
  onClose: () => void;
  onEdit?: (user: SystemUser) => void;
  canDelete?: boolean;
  onRestore?: (userId: string) => void | Promise<void>;
}

export function UserDetail({
  user,
  onClose,
  onEdit,
  canDelete = false,
  onRestore,
}: UserDetailProps): React.JSX.Element {
  const { t } = useTranslation();
  const { canManageUser } = usePermissions();
  const globalSettings = useGlobalSettings();
  const workspaceRoles = useWorkspaceRoles();
  const verifyEmailMutation = useUsersContractVerifyEmail();

  const handleVerifyEmail = async () => {
    try {
      await verifyEmailMutation.mutateAsync({
        params: { id: String(user.id) },
        body: {},
      });
      notify.success(t("users.emailVerifiedSuccess"));
    } catch {
      notify.error(t("errors.state.generic"));
    }
  };

  const [messagingTarget, setMessagingTarget] = useState<{
    channel: "sms" | "whatsapp" | "email";
    recipients: Array<{ id: string; name: string; phone: string; email: string }>;
  } | null>(null);

  const isArchived = Boolean(user.deletedAt);
  const canManageThisUser = canManageUser(user.role);
  const canMutate = !isArchived && canManageThisUser;

  const workspaceRole = resolveWorkspaceRole(user.role, workspaceRoles);
  const effectivePerms = workspaceRole?.permissions ?? {};

  const fmtDate = (ts: string): string => {
    if (!ts) return t("users.never");
    return formatDate(ts, globalSettings.dateFormat, false);
  };

  const handleCompose = (channel: "sms" | "whatsapp" | "email") => {
    if (isArchived) return;
    setMessagingTarget({
      channel,
      recipients: [{ id: user.id, name: user.name, phone: user.phone || "", email: user.email }],
    });
  };

  return (
    <>
      <DetailDrawerShell
        onClose={onClose}
        title={user.name}
        subtitle={isArchived ? t("users.detail.archivedSubtitle") : user.email}
        icon={Shield}
        headerActions={
          <DetailDrawerRestoreOrEditAction
            isArchived={isArchived}
            canRestore={canDelete && canManageThisUser}
            canEdit={Boolean(onEdit && canManageThisUser)}
            restoreLabel={t("users.trash.restore")}
            editLabel={t("users.edit")}
            onRestore={onRestore ? () => onRestore(String(user.id)) : undefined}
            onEdit={onEdit ? () => onEdit(user) : undefined}
          />
        }
      >
        {isArchived ? (
          <DetailDrawerArchivedBanner
            deletedAt={user.deletedAt}
            describe={(formattedDate) => t("users.detail.archivedBanner", { date: formattedDate })}
          />
        ) : null}

        <div className="mb-4 flex items-center gap-2">
          <UserStatusBadge status={user.status} />
          <UserRoleBadge roleId={user.role} />
        </div>

        <UserDetailSections
          user={user}
          canMutate={canMutate}
          fmtDate={fmtDate}
          workspaceRole={workspaceRole}
          effectivePerms={effectivePerms}
          visibleModules={filterRbacModulesForSettings(globalSettings.enabledModules)}
          onCompose={handleCompose}
          onVerifyEmail={() => void handleVerifyEmail()}
          verifyEmailPending={verifyEmailMutation.isPending}
        />
      </DetailDrawerShell>

      <TenantMessageComposerLauncher
        messagingTarget={messagingTarget}
        onClose={() => setMessagingTarget(null)}
      />
    </>
  );
}

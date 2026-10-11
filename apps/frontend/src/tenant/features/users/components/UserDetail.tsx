import React, { lazy, Suspense, useState } from "react";
import { Shield } from "lucide-react";
import {
  filterRbacModulesForSettings,
  formatDate,
  resolveWorkspaceRole,
  type SystemUser,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { Drawer } from "@/components/ui/Drawer";
import {
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
} from "@/components/ui/DetailDrawerArchiveChrome";
import { UserRoleBadge, UserStatusBadge } from "@/tenant/features/users/components/UserBadges";
import { notify } from "@/lib/notify";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { useUsersContractVerifyEmail } from "@/tenant/hooks/collections/users";
import { UserDetailSections } from "@/tenant/features/users/components/UserDetailSections";

const MessageComposer = lazy(() => import("@/tenant/components/messaging/TenantMessageComposer"));

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
      <Drawer
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
      </Drawer>

      {messagingTarget && (
        <Suspense fallback={null}>
          <MessageComposer
            channel={messagingTarget.channel}
            recipients={messagingTarget.recipients}
            onClose={() => setMessagingTarget(null)}
          />
        </Suspense>
      )}
    </>
  );
}

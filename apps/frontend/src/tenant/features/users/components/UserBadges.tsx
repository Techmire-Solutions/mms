import React from "react";
import {
  activityActionMeta,
  resolveWorkspaceRole,
  userStatusMeta,
  workspaceRoleLabel,
  type ActivityAction,
  type UserStatus,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";

const VARIANT_TO_TONE: Record<string, BadgeTone> = {
  primary: "primary",
  muted: "muted",
  warning: "warning",
  success: "success",
  destructive: "destructive",
};

const STATUS_CLS: Record<string, string> = {
  active: SEMANTIC_BADGE.success,
  inactive: SEMANTIC_BADGE.muted,
  suspended: SEMANTIC_BADGE.destructive,
};

export function UserRoleBadge({ roleId }: { roleId: string }): React.JSX.Element {
  const { t } = useTranslation();
  const roles = useWorkspaceRoles();
  const role = resolveWorkspaceRole(roleId, roles);
  if (!role) {
    return <span className="text-xs text-muted-foreground">{roleId}</span>;
  }
  return (
    <Badge as="span" tone={VARIANT_TO_TONE[role.badgeVariant] ?? "muted"} size="sm">
      {workspaceRoleLabel(role, t)}
    </Badge>
  );
}

export function UserStatusBadge({ status }: { status: UserStatus }): React.JSX.Element {
  const { t } = useTranslation();
  const meta = userStatusMeta(status);
  const config: Record<string, StatusBadgeConfigItem> = {
    active: { label: t("users.status.active"), cls: STATUS_CLS.active },
    inactive: { label: t("users.status.inactive"), cls: STATUS_CLS.inactive },
    suspended: { label: t("users.status.suspended"), cls: STATUS_CLS.suspended },
  };
  if (!meta) {
    return <StatusBadge status={status} config={config} size="sm" />;
  }
  return (
    <StatusBadge
      status={status}
      config={{
        ...config,
        [status]: { label: t(meta.labelKey), cls: STATUS_CLS[status] ?? SEMANTIC_BADGE.muted },
      }}
      size="sm"
    />
  );
}

export function ActivityActionBadge({ action }: { action: ActivityAction }): React.JSX.Element {
  const { t } = useTranslation();
  const meta = activityActionMeta(action);
  if (!meta) {
    return (
      <Badge as="span" tone="muted" size="sm">
        {action}
      </Badge>
    );
  }
  return (
    <Badge as="span" tone={VARIANT_TO_TONE[meta.badgeVariant] ?? "muted"} size="sm">
      {t(meta.labelKey)}
    </Badge>
  );
}

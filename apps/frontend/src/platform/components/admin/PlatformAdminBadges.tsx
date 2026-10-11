import { PLATFORM_PERMISSION_CONFIG } from "@/platform/lib/platformPermissionConfig";
import React from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import type { PlatformUserProfile } from "@mms/shared";

export interface PlatformAdminStatusBadgesProps {
  admin: PlatformUserProfile;
}

export function PlatformAdminStatusBadges({
  admin,
}: PlatformAdminStatusBadgesProps): React.JSX.Element {
  const { t } = useTranslation();
  const isDisabled = Boolean(admin.disabledAt);

  return (
    <div className="flex flex-wrap gap-1.5">
      {isDisabled ? (
        <StatusBadge
          status="disabled"
          config={{
            disabled: {
              label: t("platform.adminDisabled"),
              cls: SEMANTIC_BADGE.destructive,
            },
          }}
          size="sm"
        />
      ) : null}
      <StatusBadge
        status={admin.role}
        config={{
          super_user: {
            label: t("platform.roleSuperUser"),
            cls: SEMANTIC_BADGE.primary,
          },
          admin: { label: t("platform.roleAdmin"), cls: SEMANTIC_BADGE.muted },
        }}
        size="sm"
      />
    </div>
  );
}

export interface PlatformAdminPermissionsBadgesProps {
  admin: PlatformUserProfile;
}

export function PlatformAdminPermissionsBadges({
  admin,
}: PlatformAdminPermissionsBadgesProps): React.JSX.Element {
  const { t } = useTranslation();

  if (admin.role !== "admin") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const perms = admin.permissions;
  const activePerms = PLATFORM_PERMISSION_CONFIG.filter(({ key }) => perms?.[key]);

  if (activePerms.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">{t("platform.adminNoCapabilities")}</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {activePerms.map(({ key, labelKey }) => (
        <StatusBadge
          key={key}
          status={key}
          config={{
            [key]: {
              label: t(labelKey),
              cls: SEMANTIC_BADGE.primary,
            },
          }}
          size="sm"
        />
      ))}
    </div>
  );
}

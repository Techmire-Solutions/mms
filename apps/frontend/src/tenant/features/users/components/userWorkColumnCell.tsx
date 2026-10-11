import type { ReactNode } from "react";
import type { SystemUser } from "@mms/shared";
import { Badge } from "@/components/ui/badge";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { UserRoleBadge, UserStatusBadge } from "@/tenant/features/users/components/UserBadges";

/** Render a Users Work column value (non-face system columns). */
export function renderUserWorkColumnValue(
  user: SystemUser,
  columnKey: string,
  options: {
    t: TranslationFunction;
    formatLoginDate: (timestamp: string) => string;
    /** Replacement shown for empty values. */
    emptyFallback?: ReactNode;
  },
): ReactNode {
  const { t, formatLoginDate, emptyFallback } = options;

  switch (columnKey) {
    case "email":
      return user.email?.trim() ? user.email : emptyFallback;
    case "role":
      return <UserRoleBadge roleId={user.role} />;
    case "status":
      return <UserStatusBadge status={user.status} />;
    case "lastLogin":
      return formatLoginDate(user.lastLogin);
    case "created":
      return <span className="font-mono">{user.createdDate}</span>;
    case "twoFactor":
      return (
        <Badge as="span" tone={user.twoFactorEnabled ? "success" : "muted"} size="sm">
          {user.twoFactorEnabled ? t("users.twoFactorOn") : t("users.twoFactorOff")}
        </Badge>
      );
    default:
      return emptyFallback;
  }
}

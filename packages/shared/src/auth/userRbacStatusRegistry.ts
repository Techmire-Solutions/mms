import type { AppTranslationKey } from "../i18n/appTranslations.js";
import type { UserBadgeVariant, UserStatus } from "./userEntityTypes.js";

export const USER_STATUSES: readonly UserStatus[] = ["active", "inactive", "suspended"] as const;

export const USER_STATUS_REGISTRY: readonly {
  id: UserStatus;
  labelKey: AppTranslationKey;
  badgeVariant: UserBadgeVariant;
}[] = [
  { id: "active", labelKey: "users.status.active", badgeVariant: "success" },
  { id: "inactive", labelKey: "users.status.inactive", badgeVariant: "muted" },
  { id: "suspended", labelKey: "users.status.suspended", badgeVariant: "destructive" },
] as const;

export const USER_STATUS_MAP: Readonly<Record<UserStatus, (typeof USER_STATUS_REGISTRY)[number]>> =
  Object.freeze(
    Object.fromEntries(USER_STATUS_REGISTRY.map((status) => [status.id, status])) as Record<
      UserStatus,
      (typeof USER_STATUS_REGISTRY)[number]
    >,
  );

export function isValidUserStatus(status: unknown): status is UserStatus {
  return (
    typeof status === "string" && Object.prototype.hasOwnProperty.call(USER_STATUS_MAP, status)
  );
}

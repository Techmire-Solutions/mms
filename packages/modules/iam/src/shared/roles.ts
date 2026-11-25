export {
  ALL_SYSTEM_ROLE_IDS,
  DEFAULT_WORKSPACE_ROLES,
  isAdminRole,
  isPlatformManagedRole,
  isSuperAdminRole,
  isSystemRole,
} from "@mms/contracts";

/** Platform-only super-user role id. */
export const PLATFORM_SUPER_USER_ROLE = "super_user" as const;
/** Grantable platform capability that gates the whole IAM surface. */
export const PLATFORM_ADMIN_PERMISSION = "admins" as const;
/** @deprecated alias — use {@link PLATFORM_ADMIN_PERMISSION}. */
export const PLATFORM_IAM_PERMISSION = PLATFORM_ADMIN_PERMISSION;

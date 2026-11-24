export {
  ALL_PERMISSIONS,
  DEFAULT_PLATFORM_ADMIN_PERMISSIONS,
  FULL_PLATFORM_ADMIN_PERMISSIONS,
  PLATFORM_ADMIN_PERMISSION_KEYS,
  roleHasPermission,
} from "@mms/contracts";
export type { Permission, PlatformAdminPermissions } from "@mms/contracts";

/** IAM-owned permission keys; the full matrix stays in `@mms/contracts`. */
export const IAM_PERMISSION_KEYS = ["users.read", "users.manage", "admins"] as const;
export type IamPermissionKey = (typeof IAM_PERMISSION_KEYS)[number];

export function isIamPermission(key: string): key is IamPermissionKey {
  return (IAM_PERMISSION_KEYS as readonly string[]).includes(key);
}

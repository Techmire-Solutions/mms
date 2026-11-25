import { platformUserCan, type PlatformAdminPermissionKey } from "@mms/contracts";
import { usePlatformAuth } from "@/platform/features/auth/lib/PlatformAuthContext";

/** Platform capability checks from the live session user (DB-backed permissions). */
export function usePlatformPermissions() {
  const { platformUser, isPlatformAuthenticated } = usePlatformAuth();

  const can = (permission: PlatformAdminPermissionKey): boolean =>
    isPlatformAuthenticated && platformUserCan(platformUser, permission);

  return {
    platformUser,
    isPlatformAuthenticated,
    isSuperUser: platformUser?.role === "super_user",
    canWorkspaces: can("workspaces"),
    canOnboard: can("onboard"),
    canSettings: can("settings"),
    canAdmins: can("admins"),
    canSystem: can("system"),
    canContacts: can("contacts"),
    canMessaging: can("messaging"),
    can,
  };
}

export type PlatformPermissionsState = ReturnType<typeof usePlatformPermissions>;

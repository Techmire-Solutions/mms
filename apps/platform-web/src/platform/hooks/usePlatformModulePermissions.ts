import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import type { PlatformModuleManifest } from "@/platform/lib/platformModuleManifest";

export interface UsePlatformModulePermissionsResult {
  canRead: boolean;
  canWrite: boolean;
  canReports: boolean;
  canViewSetup: boolean;
  canEditSetup: boolean;
}

/**
 * Maps a platform module manifest to tenant-style capability booleans.
 * Platform grants are coarse (one capability per module), so read/write map to
 * the same module capability; Reports/Setup reuse their optional sub-capabilities.
 */
export function usePlatformModulePermissions(
  manifest: PlatformModuleManifest,
): UsePlatformModulePermissionsResult {
  const { can, isSuperUser } = usePlatformPermissions();

  const canRead = isSuperUser || can(manifest.permissionKey);
  const canWrite = canRead;
  const canReports =
    canRead && (isSuperUser || can(manifest.reportsPermissionKey ?? manifest.permissionKey));
  const canViewSetup = canRead && (isSuperUser || can(manifest.setupPermissionKey ?? "settings"));
  const canEditSetup = canViewSetup;

  return { canRead, canWrite, canReports, canViewSetup, canEditSetup };
}

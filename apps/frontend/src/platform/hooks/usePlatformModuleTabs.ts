import { useFilteredModuleTierTabs, type ModuleTierTab } from "@/hooks/useModuleTierTabs";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import type { PlatformModuleManifest } from "@/platform/lib/platformModuleManifest";

/**
 * Tier tabs for a platform module — Work (labeled with the module name),
 * Reports, and Setup — gated on the module's platform capability.
 */
export function usePlatformModuleTabs(manifest: PlatformModuleManifest): ModuleTierTab[] {
  const { can, isSuperUser } = usePlatformPermissions();
  const canViewModule = isSuperUser || can(manifest.permissionKey);
  const canViewReports =
    canViewModule && (isSuperUser || can(manifest.reportsPermissionKey ?? manifest.permissionKey));
  const canViewSetup =
    canViewModule && (isSuperUser || can(manifest.setupPermissionKey ?? "settings"));

  return useFilteredModuleTierTabs({
    canViewReports,
    canViewSetup,
    workLabelKey: manifest.workLabelKey,
  });
}

import { useFilteredModuleTierTabs, type ModuleTierTab } from "@mms/fe-core/lib/useModuleTierTabs";
import { usePlatformModulePermissions } from "@/platform/hooks/usePlatformModulePermissions";
import type { PlatformModuleManifest } from "@/platform/lib/platformModuleManifest";

/**
 * Tier tabs for a platform module — Work (labeled with the module name),
 * Reports, and Setup — gated on the module's platform capability.
 */
export function usePlatformModuleTabs(manifest: PlatformModuleManifest): ModuleTierTab[] {
  const { canReports, canViewSetup } = usePlatformModulePermissions(manifest);

  return useFilteredModuleTierTabs({
    canViewReports: canReports,
    canViewSetup,
    workLabelKey: manifest.workLabelKey,
  });
}

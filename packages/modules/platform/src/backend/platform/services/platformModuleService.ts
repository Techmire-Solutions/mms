import {
  buildPlatformModuleCatalog,
  type PlatformModuleCatalogEntry,
  type PlatformModulesUpdateInput,
  type PlatformSettings,
} from "@mms/contracts";
import { clearModuleAvailabilityCache } from "../deps.js";
import { getPlatformSettings, updatePlatformSettings } from "./platformSettingsService.js";

/** Current module catalog (availability + provisioning defaults). */
export function getPlatformModuleCatalog(): PlatformModuleCatalogEntry[] {
  return buildPlatformModuleCatalog(getPlatformSettings());
}

/** Persists module availability/defaults; availability cache is dropped immediately. */
export async function updatePlatformModules(
  input: PlatformModulesUpdateInput,
): Promise<PlatformSettings> {
  const settings = await updatePlatformSettings({
    defaultEnabledModules: input.defaultEnabledModules,
    disabledModules: input.disabledModules,
    ...(input.expectedUpdatedAt === undefined
      ? {}
      : { expectedUpdatedAt: input.expectedUpdatedAt }),
  });
  clearModuleAvailabilityCache();
  return settings;
}

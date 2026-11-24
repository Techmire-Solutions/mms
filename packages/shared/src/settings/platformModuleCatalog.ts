/** Platform-wide module availability + new-workspace provisioning defaults. */
import {
  SYSTEM_MODULES,
  SYSTEM_MODULES_BY_ID,
  type ModuleDefinition,
} from "./globalSettingsModuleRegistry.js";

/** Catalog row used by the platform Modules settings tab and the onboarding wizard. */
export interface PlatformModuleCatalogEntry extends ModuleDefinition {
  /** Enabled by default for a newly provisioned workspace. */
  defaultEnabled: boolean;
  /** Available on this platform instance (false = hidden/denied for every workspace). */
  platformEnabled: boolean;
}

/** Filters to known, non-required module ids, de-duplicated. */
export function normalizePlatformModuleIdList(ids?: readonly string[] | null): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string") continue;
    const definition = SYSTEM_MODULES_BY_ID[id];
    if (!definition || definition.required) continue;
    seen.add(id);
  }
  return [...seen];
}

/** Normalizes per-module defaults; required modules are always enabled. */
export function normalizePlatformDefaultModules(
  partial?: Record<string, boolean> | null,
): Record<string, boolean> {
  const merged: Record<string, boolean> = Object.fromEntries(
    SYSTEM_MODULES.map((module) => [module.id, true]),
  );
  if (partial) {
    for (const [id, value] of Object.entries(partial)) {
      if (SYSTEM_MODULES_BY_ID[id] && typeof value === "boolean") merged[id] = value;
    }
  }
  for (const module of SYSTEM_MODULES) {
    if (module.required) merged[module.id] = true;
  }
  return merged;
}

/** Drops required/unknown ids from a stored platform-disabled list. */
export function normalizePlatformDisabledModules(ids?: readonly string[] | null): string[] {
  return normalizePlatformModuleIdList(ids);
}

/** True when the module may be used anywhere on this platform instance. */
export function isPlatformModuleAvailable(
  settings: { disabledModules?: readonly string[] | null } | null | undefined,
  moduleId: string,
): boolean {
  if (!settings) return true;
  return !(settings.disabledModules ?? []).includes(moduleId);
}

/** Builds the catalog consumed by Settings → Modules and onboarding. */
export function buildPlatformModuleCatalog(
  input?: {
    defaultEnabledModules?: Record<string, boolean> | null;
    disabledModules?: readonly string[] | null;
  } | null,
): PlatformModuleCatalogEntry[] {
  const defaults = normalizePlatformDefaultModules(input?.defaultEnabledModules);
  const disabled = new Set(normalizePlatformDisabledModules(input?.disabledModules));
  return SYSTEM_MODULES.map((module) => ({
    ...module,
    defaultEnabled: Boolean(defaults[module.id]),
    platformEnabled: !disabled.has(module.id),
  }));
}

/** Modules a new workspace should start with when the operator sends no explicit list. */
export function resolvePlatformProvisionedModuleIds(
  settings:
    | {
        defaultEnabledModules?: Record<string, boolean> | null;
        disabledModules?: readonly string[] | null;
      }
    | null
    | undefined,
): string[] {
  const catalog = buildPlatformModuleCatalog(settings);
  return catalog.filter((entry) => entry.platformEnabled && entry.defaultEnabled).map((e) => e.id);
}

/** Rejects a requested module list that names a platform-disabled module. */
export function findPlatformBlockedModule(
  requestedModuleIds: readonly string[] | null | undefined,
  settings: { disabledModules?: readonly string[] | null } | null | undefined,
): string | null {
  if (!requestedModuleIds?.length) return null;
  const disabled = new Set(normalizePlatformDisabledModules(settings?.disabledModules));
  return requestedModuleIds.find((id) => disabled.has(id)) ?? null;
}

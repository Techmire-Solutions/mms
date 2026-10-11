/**
 * @file userRbacPermissionNav.ts
 * @description Layout grouping and ordering of RBAC module rows for the permissions matrix.
 */

import type { AppTranslationKey } from "./appTranslations.js";
import type { RbacModuleDef } from "./userEntityTypes.js";
import { canonicalizeRbacModuleId, type RbacModuleId } from "./userRbacModuleRegistry.js";

/** Standalone RBAC row in the permissions matrix nav layout. */
export interface RbacPermissionNavModule {
  type: "module";
  rbacId: RbacModuleId | string;
}

/** Grouped RBAC rows — mirrors sidebar Academics section. */
export interface RbacPermissionNavGroup {
  type: "group";
  groupId: string;
  labelKey: AppTranslationKey;
  rbacIds: readonly (RbacModuleId | string)[];
}

export type RbacPermissionNavEntry = RbacPermissionNavModule | RbacPermissionNavGroup;

/**
 * Permissions matrix section order — aligned with `NAV_ITEMS` / `SYSTEM_MODULE_NAV`
 * (standalone items + Academics group; RBAC ids where they differ from `moduleId`).
 */
export const RBAC_PERMISSION_NAV: readonly RbacPermissionNavEntry[] = [
  { type: "module", rbacId: "dashboard" },
  { type: "module", rbacId: "contacts" },
  { type: "module", rbacId: "faculty" },
  { type: "module", rbacId: "messaging" },
  { type: "module", rbacId: "tasks" },
  { type: "module", rbacId: "tasks.assign_anywhere" },
  {
    type: "group",
    groupId: "academics",
    labelKey: "nav.academics",
    rbacIds: [
      "students",
      "sessions",
      "attendance",
      "enrollments",
      "hasanat",
      "examinations",
      "questionBank",
    ],
  },
  { type: "module", rbacId: "finance" },
  { type: "module", rbacId: "accounting" },
  { type: "module", rbacId: "obligations" },
  { type: "module", rbacId: "users" },
  { type: "module", rbacId: "settings" },
] as const;

/** One render section in the permissions matrix (optional group heading + module rows). */
export interface RbacPermissionMatrixGroup {
  groupId: string;
  labelKey?: AppTranslationKey;
  modules: RbacModuleDef[];
}

/** Helper checking if a group represents a multi-module category. */
export function isRbacPermissionGroup(group: RbacPermissionMatrixGroup): boolean {
  return Boolean(group.labelKey && group.modules.length > 0);
}

/** Orders visible RBAC modules into sidebar-aligned groups for the permissions matrix. */
export function groupRbacModulesForPermissionsNav(
  visibleModules: readonly RbacModuleDef[],
): RbacPermissionMatrixGroup[] {
  const moduleById = new Map(
    visibleModules.map((moduleDefinition) => [
      canonicalizeRbacModuleId(moduleDefinition.id),
      moduleDefinition,
    ]),
  );
  const placed = new Set<string>();
  const groups: RbacPermissionMatrixGroup[] = [];

  const pushStandalone = (rbacId: string): void => {
    const canonicalId = canonicalizeRbacModuleId(rbacId);
    const moduleDefinition = moduleById.get(canonicalId);
    if (!moduleDefinition || placed.has(canonicalId)) return;
    placed.add(canonicalId);
    groups.push({
      groupId: `module-${canonicalId}`,
      modules: [moduleDefinition],
    });
  };

  for (const entry of RBAC_PERMISSION_NAV) {
    if (entry.type === "module") {
      pushStandalone(entry.rbacId);
      continue;
    }
    const mods: RbacModuleDef[] = [];
    for (const rbacId of entry.rbacIds) {
      const canonicalId = canonicalizeRbacModuleId(rbacId);
      const moduleDefinition = moduleById.get(canonicalId);
      if (moduleDefinition && !placed.has(canonicalId)) {
        mods.push(moduleDefinition);
        placed.add(canonicalId);
      }
    }
    if (mods.length > 0) {
      groups.push({
        groupId: `group-${entry.groupId}`,
        labelKey: entry.labelKey,
        modules: mods,
      });
    }
  }

  for (const mod of visibleModules) {
    const canonicalId = canonicalizeRbacModuleId(mod.id);
    if (!placed.has(canonicalId)) {
      placed.add(canonicalId);
      groups.push({
        groupId: `module-${canonicalId}`,
        modules: [mod],
      });
    }
  }

  return groups;
}

/** Flattens permission matrix groups into an ordered list of module definitions. */
export function flattenRbacPermissionGroups(
  groups: readonly RbacPermissionMatrixGroup[],
): RbacModuleDef[] {
  return groups.flatMap((group) => group.modules);
}

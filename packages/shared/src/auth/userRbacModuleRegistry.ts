/**
 * @file userRbacModuleRegistry.ts
 * @description Single source of truth for RBAC permission modules and system-settings integration.
 */

import { SYSTEM_MODULES_BY_ID, normalizeEnabledModules } from "../settings/settingsTypes.js";
import type { RbacModuleDef } from "./userEntityTypes.js";

/** Canonical tuple of all 19 RBAC module identifiers (includes Tasks elevate capability). */
export const RBAC_MODULE_IDS = [
  "dashboard",
  "contacts",
  "faculty",
  "messaging",
  "tasks",
  "tasks.assign_anywhere",
  "students",
  "sessions",
  "attendance",
  "enrollments",
  "hasanat",
  "examinations",
  "questionBank",
  "finance",
  "accounting",
  "obligations",
  "users",
  "settings",
] as const;

export type RbacModuleId = (typeof RBAC_MODULE_IDS)[number];

export const RBAC_MODULE_REGISTRY: readonly RbacModuleDef[] = [
  { id: "dashboard", labelKey: "nav.dashboard" },
  { id: "contacts", labelKey: "nav.contacts" },
  { id: "faculty", labelKey: "nav.faculty" },
  { id: "messaging", labelKey: "nav.messaging" },
  { id: "tasks", labelKey: "nav.tasks" },
  { id: "tasks.assign_anywhere", labelKey: "users.rbac.tasksAssignAnywhere" },
  { id: "students", labelKey: "nav.students" },
  { id: "sessions", labelKey: "nav.sessions" },
  { id: "attendance", labelKey: "nav.attendance" },
  { id: "enrollments", labelKey: "nav.enrollments" },
  { id: "hasanat", labelKey: "nav.hasanatCards" },
  { id: "examinations", labelKey: "nav.examinations" },
  { id: "questionBank", labelKey: "nav.questionBank" },
  { id: "finance", labelKey: "nav.finance" },
  { id: "accounting", labelKey: "nav.accounting" },
  { id: "obligations", labelKey: "nav.obligations" },
  { id: "users", labelKey: "nav.users" },
  { id: "settings", labelKey: "nav.settings" },
] as const;

/** Fast O(1) module definition lookup map. */
export const RBAC_MODULES_BY_ID: Readonly<Record<RbacModuleId, RbacModuleDef>> = Object.freeze(
  Object.fromEntries(RBAC_MODULE_REGISTRY.map((m) => [m.id, m])) as Record<
    RbacModuleId,
    RbacModuleDef
  >,
);

/** Canonical legacy aliases for backwards compatibility with historical permissions and tokens. */
export const LEGACY_RBAC_MODULE_ALIASES: Readonly<Record<string, RbacModuleId>> = Object.freeze({});

/** Resolves an RBAC module identifier to its canonical name. */
export function canonicalizeRbacModuleId(id: string): RbacModuleId | string {
  return LEGACY_RBAC_MODULE_ALIASES[id] ?? id;
}

/** Retrieves module definition for a given RBAC module ID (with legacy alias support). */
export function getRbacModuleDef(id: string): RbacModuleDef | undefined {
  const canonical = canonicalizeRbacModuleId(id) as RbacModuleId;
  return RBAC_MODULES_BY_ID[canonical];
}

/** Type guard verifying if a string is a valid canonical RbacModuleId. */
export function isValidRbacModuleId(id: unknown): id is RbacModuleId {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(RBAC_MODULES_BY_ID, id);
}

/**
 * Maps RBAC matrix row ids to `global_settings.enabledModules` keys where they differ.
 * (e.g. RBAC `enrollments` ↔ system module `enrollment`.)
 */
export const RBAC_SYSTEM_MODULE_ID: Readonly<Record<string, string>> = Object.freeze({
  enrollments: "enrollment",
  examinations: "examination",
  "tasks.assign_anywhere": "tasks",
} satisfies Partial<Record<RbacModuleId, string>>);

/** Resolves the system-modules settings key for an RBAC permission row. */
export function rbacModuleSystemId(rbacModuleId: string): string {
  const canonical = canonicalizeRbacModuleId(rbacModuleId);
  return RBAC_SYSTEM_MODULE_ID[canonical] ?? canonical;
}

/** Helper evaluating whether a normalized module toggle allows an RBAC module. */
function isNormalizedModuleEnabled(
  rbacModuleId: string,
  normalized: Record<string, boolean>,
): boolean {
  if (rbacModuleId === "settings") return true;
  const systemId = rbacModuleSystemId(rbacModuleId);
  if (!SYSTEM_MODULES_BY_ID[systemId]) return true;
  return normalized[systemId] !== false;
}

/**
 * Whether an RBAC module row should appear in the permissions matrix
 * (respects Settings → System Modules toggles).
 */
export function isRbacModuleEnabled(
  rbacModuleId: string,
  enabledModules?: Record<string, boolean> | null,
): boolean {
  const normalized = normalizeEnabledModules(enabledModules);
  return isNormalizedModuleEnabled(rbacModuleId, normalized);
}

/** RBAC registry rows visible for the current workspace module toggles. */
export function filterRbacModulesForSettings(
  enabledModules?: Record<string, boolean> | null,
): RbacModuleDef[] {
  const normalized = normalizeEnabledModules(enabledModules);
  return RBAC_MODULE_REGISTRY.filter((m) => isNormalizedModuleEnabled(m.id, normalized));
}

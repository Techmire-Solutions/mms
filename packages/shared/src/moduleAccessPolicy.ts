import type { Permission } from "./permissions.js";
import { SYSTEM_MODULES, normalizeEnabledModules } from "./globalSettingsTypes.js";
import { ACCOUNTING_MODULE_MANIFEST } from "./accountingModuleManifest.js";
import { ATTENDANCE_MODULE_MANIFEST } from "./attendanceModuleManifest.js";
import { CONTACTS_MODULE_MANIFEST } from "./contactsModuleManifest.js";
import { DASHBOARD_MODULE_MANIFEST } from "./dashboardModuleManifest.js";
import { ENROLLMENTS_MODULE_MANIFEST } from "./enrollmentsModuleManifest.js";
import { EXAMINATIONS_MODULE_MANIFEST } from "./examinationsModuleManifest.js";
import { FACULTY_MODULE_MANIFEST } from "./facultyModuleManifest.js";
import { FINANCE_MODULE_MANIFEST } from "./financeModuleManifest.js";
import { HASANAT_MODULE_MANIFEST } from "./hasanatModuleManifest.js";
import { MESSAGING_MODULE_MANIFEST } from "./messagingModuleManifest.js";
import { OBLIGATIONS_MODULE_MANIFEST } from "./obligationsModuleManifest.js";
import { QUESTION_BANK_MODULE_MANIFEST } from "./questionBankModuleManifest.js";
import { SESSIONS_MODULE_MANIFEST } from "./sessionsModuleManifest.js";
import { STUDENTS_MODULE_MANIFEST } from "./studentsModuleManifest.js";
import { TASKS_MODULE_MANIFEST } from "./tasksModuleManifest.js";
import { USERS_MODULE_MANIFEST } from "./usersModuleManifest.js";

/** Action a request or UI entry point performs inside a module. */
export type ModulePermissionAction = "read" | "write" | "delete" | "export" | "setupWrite";
/**
 * `availability` checks grant + enablement only, for routes whose handler owns a
 * finer permission rule (self-service edits, personal preferences).
 */
export type ModuleAction = ModulePermissionAction | "availability";

/** Stable, machine-readable denial reasons shared by API responses and UI states. */
export const MODULE_ACCESS_DENIAL_CODES = [
  "MODULE_NOT_GRANTED",
  "MODULE_DISABLED",
  "PERMISSION_DENIED",
  "MODULE_ACCESS_UNAVAILABLE",
] as const;
export type ModuleAccessDenialCode = (typeof MODULE_ACCESS_DENIAL_CODES)[number];

/** Live-update object keys whose change may alter grants or enablement. */
export const MODULE_ACCESS_INVALIDATION_KEYS: ReadonlySet<string> = new Set([
  "workspace",
  "global_settings",
  "settings",
]);

/** True for 403 bodies produced by the module gate (vs. other `forbidden` errors). */
export function isModuleAccessDenialCode(value: unknown): value is ModuleAccessDenialCode {
  return (
    typeof value === "string" && (MODULE_ACCESS_DENIAL_CODES as readonly string[]).includes(value)
  );
}

/** Per-module platform grant and tenant enablement, resolved from server data. */
export interface ModuleAvailability {
  granted: boolean;
  enabled: boolean;
}
export type ModuleAvailabilityMap = Record<string, ModuleAvailability>;

export type ModuleAccessDecision =
  { allowed: true } | { allowed: false; code: ModuleAccessDenialCode };

interface ModulePermissionSource {
  readonly permissions: {
    readonly read: Permission;
    readonly write?: Permission;
    readonly delete?: Permission;
    readonly export?: Permission;
    readonly setupWrite: Permission;
  };
}

/** System module id → owning manifest. Keys are the ids stored in grants and `enabledModules`. */
const MODULE_PERMISSION_SOURCES = {
  dashboard: DASHBOARD_MODULE_MANIFEST,
  contacts: CONTACTS_MODULE_MANIFEST,
  messaging: MESSAGING_MODULE_MANIFEST,
  students: STUDENTS_MODULE_MANIFEST,
  faculty: FACULTY_MODULE_MANIFEST,
  sessions: SESSIONS_MODULE_MANIFEST,
  attendance: ATTENDANCE_MODULE_MANIFEST,
  enrollment: ENROLLMENTS_MODULE_MANIFEST,
  hasanat: HASANAT_MODULE_MANIFEST,
  examination: EXAMINATIONS_MODULE_MANIFEST,
  questionBank: QUESTION_BANK_MODULE_MANIFEST,
  finance: FINANCE_MODULE_MANIFEST,
  accounting: ACCOUNTING_MODULE_MANIFEST,
  obligations: OBLIGATIONS_MODULE_MANIFEST,
  tasks: TASKS_MODULE_MANIFEST,
  users: USERS_MODULE_MANIFEST,
} as const satisfies Record<string, ModulePermissionSource>;

export type AccessControlledModuleId = keyof typeof MODULE_PERMISSION_SOURCES;

/** Every access-controlled module id (mirrors `SYSTEM_MODULES`). */
export const ACCESS_CONTROLLED_MODULE_IDS = Object.keys(
  MODULE_PERMISSION_SOURCES,
) as AccessControlledModuleId[];

/** Manifest / legacy ids that differ from the system module id. */
const MODULE_ID_ALIASES: Readonly<Record<string, AccessControlledModuleId>> = {
  enrollments: "enrollment",
  examinations: "examination",
};

/** Canonical system module id for a system, manifest, or legacy id; `undefined` when unknown. */
export function resolveAccessModuleId(id: string): AccessControlledModuleId | undefined {
  if (Object.prototype.hasOwnProperty.call(MODULE_PERMISSION_SOURCES, id)) {
    return id as AccessControlledModuleId;
  }
  return MODULE_ID_ALIASES[id];
}

/** Permission an action requires; write falls back to read, delete/export to write/read. */
export function getModuleActionPermission(
  moduleId: AccessControlledModuleId,
  action: ModulePermissionAction,
): Permission {
  const p: ModulePermissionSource["permissions"] = MODULE_PERMISSION_SOURCES[moduleId].permissions;
  const write = p.write ?? p.read;
  switch (action) {
    case "read":
      return p.read;
    case "write":
      return write;
    case "delete":
      return p.delete ?? write;
    case "export":
      return p.export ?? p.read;
    case "setupWrite":
      return p.setupWrite;
  }
}

/**
 * Resolves availability from the workspace row. Mirrors platform semantics: an
 * empty grant map grants everything, a missing key is granted, and required
 * modules are always granted and enabled.
 */
export function buildModuleAvailability(
  grantedModules: Record<string, boolean> | null | undefined,
  enabledModules: Record<string, boolean> | null | undefined,
): ModuleAvailabilityMap {
  const grants = grantedModules ?? {};
  const grantAll = Object.keys(grants).length === 0;
  const enabled = normalizeEnabledModules(enabledModules);
  const map: ModuleAvailabilityMap = {};
  for (const mod of SYSTEM_MODULES) {
    const granted = mod.required === true || grantAll || grants[mod.id] !== false;
    map[mod.id] = { granted, enabled: granted && enabled[mod.id] !== false };
  }
  return map;
}

/** Module-level gate only (grant + enablement), independent of the user's permissions. */
export function getModuleAvailabilityDenial(
  availability: ModuleAvailabilityMap | null | undefined,
  moduleId: string,
): ModuleAccessDenialCode | null {
  if (!availability) return "MODULE_ACCESS_UNAVAILABLE";
  const canonical = resolveAccessModuleId(moduleId);
  const entry = canonical ? availability[canonical] : undefined;
  if (!entry || !entry.granted) return "MODULE_NOT_GRANTED";
  if (!entry.enabled) return "MODULE_DISABLED";
  return null;
}

/**
 * Full decision: platform grant → tenant enablement → action permission.
 * `availability` must come from authoritative server data, never client state.
 */
export function evaluateModuleAccess(input: {
  moduleId: string;
  availability: ModuleAvailabilityMap | null | undefined;
  can: (permission: Permission) => boolean;
  action?: ModuleAction;
}): ModuleAccessDecision {
  const moduleDenial = getModuleAvailabilityDenial(input.availability, input.moduleId);
  if (moduleDenial) return { allowed: false, code: moduleDenial };
  const action = input.action ?? "read";
  if (action === "availability") return { allowed: true };
  const canonical = resolveAccessModuleId(input.moduleId) as AccessControlledModuleId;
  const permission = getModuleActionPermission(canonical, action);
  return input.can(permission) ? { allowed: true } : { allowed: false, code: "PERMISSION_DENIED" };
}

/** Collapses availability to the `enabledModules`-shaped flags used by legacy helpers. */
export function toEffectiveModuleFlags(
  availability: ModuleAvailabilityMap | null | undefined,
): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const id of ACCESS_CONTROLLED_MODULE_IDS) {
    flags[id] = getModuleAvailabilityDenial(availability, id) === null;
  }
  return flags;
}

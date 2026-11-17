import { z } from "zod";
import {
  PERMISSION_ACTIONS,
  type PermissionAction,
  type PermissionMap,
  type UserBadgeVariant,
  type WorkspaceRole,
} from "./userEntityTypes.js";
import { canonicalizeRbacModuleId, isValidRbacModuleId } from "./userRbacModuleRegistry.js";

/** Longest custom role name the settings UI accepts. */
export const WORKSPACE_ROLE_NAME_MAX = 80;
/** Longest custom role description the settings UI accepts. */
export const WORKSPACE_ROLE_DESCRIPTION_MAX = 200;

const permissionActionsSchema = z
  .array(z.enum(PERMISSION_ACTIONS))
  .max(PERMISSION_ACTIONS.length)
  .superRefine((actions, ctx) => {
    if (new Set(actions).size !== actions.length) {
      ctx.addIssue({ code: "custom", message: "Permission actions must be unique" });
    }
  });

/** The editable fields of a custom workspace role. */
export const workspaceRoleWriteSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1, "Role name is required").max(WORKSPACE_ROLE_NAME_MAX),
    description: z.string().trim().max(WORKSPACE_ROLE_DESCRIPTION_MAX).optional().default(""),
    permissions: z.record(z.string(), permissionActionsSchema),
  })
  .strict();

export type WorkspaceRoleWrite = z.input<typeof workspaceRoleWriteSchema>;

/** Persisted role shape accepted on the preferences write path (metadata passthrough). */
export const workspaceRolePersistedSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    permissions: z.record(z.string(), z.array(z.string())),
  })
  .passthrough();

/**
 * Normalises a permission map to canonical module ids and known actions.
 *
 * Unknown modules/actions are dropped (the UI may hold rows for a module that was
 * removed), duplicates are removed and actions follow the shared order so dirty
 * comparisons and persisted JSON stay stable.
 */
export function normalizePermissionMap(
  permissions: unknown,
  allowedModuleIds?: readonly string[],
): PermissionMap {
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) return {};
  const allowed = allowedModuleIds ? new Set(allowedModuleIds) : null;
  const normalized: PermissionMap = {};
  for (const [rawModuleId, rawActions] of Object.entries(permissions)) {
    const moduleId = canonicalizeRbacModuleId(rawModuleId);
    if (!isValidRbacModuleId(moduleId)) continue;
    if (allowed && !allowed.has(moduleId)) continue;
    if (!Array.isArray(rawActions)) continue;
    const actions = PERMISSION_ACTIONS.filter((action) =>
      (rawActions as unknown[]).includes(action),
    );
    if (actions.length > 0) normalized[moduleId] = actions;
  }
  return normalized;
}

/** Drops invalid/unknown module entries from a persisted role without touching its metadata. */
export function normalizePersistedWorkspaceRole(role: WorkspaceRole): WorkspaceRole {
  return {
    ...role,
    permissions: normalizePermissionMap(role?.permissions),
  };
}

const BADGE_VARIANTS: readonly UserBadgeVariant[] = [
  "primary",
  "muted",
  "warning",
  "destructive",
  "success",
];

/**
 * Serialises the editable role form fields into the full WorkspaceRole persisted in
 * users preferences. Metadata from the existing role (system flag, source roles,
 * faculty ownership) is preserved; new roles are always non-system.
 */
export function serializeWorkspaceRoleWrite(
  input: WorkspaceRoleWrite,
  existing?: WorkspaceRole | null,
): WorkspaceRole {
  const parsed = workspaceRoleWriteSchema.parse(input);
  const permissions = normalizePermissionMap(parsed.permissions);
  return {
    id: existing?.id ?? parsed.id,
    labelKey: existing?.labelKey ?? "users.role.custom",
    descriptionKey: existing?.descriptionKey ?? "users.role.customDesc",
    customLabel: parsed.name,
    customDescription: parsed.description,
    permissions,
    isSystem: existing?.isSystem ?? false,
    badgeVariant:
      existing?.badgeVariant && BADGE_VARIANTS.includes(existing.badgeVariant)
        ? existing.badgeVariant
        : "primary",
    ...(existing?.managedBy ? { managedBy: existing.managedBy } : {}),
    ...(existing?.sourceRoleIds?.length
      ? { sourceRoleIds: [...new Set(existing.sourceRoleIds)].sort() }
      : {}),
  };
}

/** True when the role has at least one action on at least one module. */
export function hasWorkspaceRolePermissions(permissions: PermissionMap): boolean {
  return Object.values(permissions).some((actions) => actions.length > 0);
}

export type { PermissionAction };

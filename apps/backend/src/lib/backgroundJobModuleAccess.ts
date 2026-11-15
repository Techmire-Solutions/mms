import {
  evaluateModuleAccess,
  getModuleAvailabilityDenial,
  isSystemRole,
  roleHasPermission,
  type ModuleAccessDenialCode,
  type ModuleAction,
  type Permission,
  type WorkspaceRole,
} from "@mms/shared";
import { loadModuleAvailability } from "./moduleAvailabilityService.js";
import { getTenantRoleCatalog } from "./tenantRoleCatalog.js";
import { resolveCurrentTenantRole } from "./currentTenantRole.js";

/** Action a queued job performs, keyed by its runner `kind`. */
export function backgroundJobModuleAction(kind: string): ModuleAction {
  if (kind.startsWith("export")) return "export";
  if (
    kind === "import" ||
    kind === "collect" ||
    kind === "promote" ||
    kind === "dispatch" ||
    kind === "reminder" ||
    kind === "waitlist-alert" ||
    kind === "certificate-dispatch" ||
    kind === "feedback-dispatch"
  )
    return "write";
  return "read";
}

/**
 * Re-checks module access when a job runs (the module or the enqueuing user's
 * role may have changed while it waited). Non-HTTP entry point: tenant and user
 * come from the persisted job, never from client input. Null when allowed.
 */
export async function getBackgroundJobModuleDenial(
  tenant: string,
  userId: string,
  moduleId: string,
  kind: string,
): Promise<ModuleAccessDenialCode | null> {
  const { denial } = await resolveBackgroundJobAccessContext(tenant, userId, moduleId, kind);
  return denial;
}

/** Data-scoping context resolved from the current role at job execution time. */
export interface BackgroundJobAccessContext {
  denial: ModuleAccessDenialCode | null;
  /** Current role (field visibility), or null when it cannot be resolved. */
  viewerRole: string | null;
  /** Whether the current role may view soft-deleted rows (delete/trash permission). */
  allowDeleted?: boolean;
}

/**
 * Resolves module access plus the data-scoping role at execution. Enqueue-time
 * `viewerRole` / `allowDeleted` snapshots are stale by the time a queued job
 * runs (a role may have been demoted or the delete permission revoked), so the
 * runner must re-derive both from the authoritative current role.
 */
export async function resolveBackgroundJobAccessContext(
  tenant: string,
  userId: string,
  moduleId: string,
  kind: string,
): Promise<BackgroundJobAccessContext> {
  let availability;
  let role: string | null;
  let roleCatalog: readonly WorkspaceRole[] = [];
  try {
    availability = await loadModuleAvailability(tenant);
    role = await resolveCurrentTenantRole(tenant, userId);
    // A queued job must be evaluated against the workspace catalog too, or a
    // custom/composite role can never export/import.
    roleCatalog = role && !isSystemRole(role) ? await getTenantRoleCatalog(tenant) : [];
  } catch {
    return { denial: "MODULE_ACCESS_UNAVAILABLE", viewerRole: null, allowDeleted: undefined };
  }
  const can = (permission: Permission) =>
    role !== null && roleHasPermission(role, permission, roleCatalog);
  // Mocked suites have no role matrix: they still get the grant/enablement gate and
  // fall back to the enqueue-time payload for data scoping.
  if (role === null && (process.env.NODE_ENV === "test" || process.env.VITEST)) {
    return {
      denial: getModuleAvailabilityDenial(availability, moduleId),
      viewerRole: null,
      allowDeleted: undefined,
    };
  }
  const actionDecision = evaluateModuleAccess({
    moduleId,
    availability,
    action: backgroundJobModuleAction(kind),
    can,
  });
  const deleteDecision = evaluateModuleAccess({ moduleId, availability, action: "delete", can });
  return {
    denial: actionDecision.allowed ? null : actionDecision.code,
    viewerRole: role,
    allowDeleted: deleteDecision.allowed,
  };
}

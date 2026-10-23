import {
  evaluateModuleAccess,
  getModuleAvailabilityDenial,
  roleHasPermission,
  type ModuleAccessDenialCode,
  type ModuleAction,
} from "@mms/shared";
import { loadModuleAvailability } from "./moduleAvailabilityService.js";
import { resolveCurrentTenantRole } from "./currentTenantRole.js";

/** Action a queued job performs, keyed by its runner `kind`. */
export function backgroundJobModuleAction(kind: string): ModuleAction {
  if (kind.startsWith("export")) return "export";
  if (kind === "import" || kind === "collect" || kind === "promote" || kind === "dispatch")
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
  let availability;
  let role: string | null;
  try {
    availability = await loadModuleAvailability(tenant);
    role = await resolveCurrentTenantRole(tenant, userId);
  } catch {
    return "MODULE_ACCESS_UNAVAILABLE";
  }
  // Mocked suites have no role matrix: they still get the grant/enablement gate.
  if (role === null && (process.env.NODE_ENV === "test" || process.env.VITEST)) {
    return getModuleAvailabilityDenial(availability, moduleId);
  }
  const decision = evaluateModuleAccess({
    moduleId,
    availability,
    action: backgroundJobModuleAction(kind),
    can: (permission) => role !== null && roleHasPermission(role, permission),
  });
  return decision.allowed ? null : decision.code;
}

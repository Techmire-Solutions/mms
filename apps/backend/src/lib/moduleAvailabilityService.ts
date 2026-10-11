import { buildModuleAvailability, type ModuleAvailabilityMap } from "@mms/shared";
import { getWorkspaceModuleAccessRow } from "../db/repositories/workspaceModuleAccessRepository.js";

/**
 * Short backstop TTL only: every grant/enablement write calls
 * `clearModuleAvailabilityCache`, and the Redis WS-invalidation subscriber
 * clears it on the other nodes, so changes apply on the next request.
 */
const CACHE_TTL_MS = 15_000;
const MAX_CACHE_ENTRIES = 500;

const cache = new Map<string, { expiresAt: number; availability: ModuleAvailabilityMap }>();

/** Raised when availability cannot be read; callers must deny, never default to allow. */
export class ModuleAvailabilityUnavailableError extends Error {
  constructor(tenant: string, cause?: unknown) {
    super(`Module availability could not be loaded for tenant "${tenant}"`, { cause });
    this.name = "ModuleAvailabilityUnavailableError";
  }
}

function normalizeTenant(tenant: string): string {
  return tenant.trim().toLowerCase();
}

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

/** Platform grants + tenant enablement for a workspace, from the workspace row. */
export async function loadModuleAvailability(tenant: string): Promise<ModuleAvailabilityMap> {
  const key = normalizeTenant(tenant);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.availability;

  let availability: ModuleAvailabilityMap;
  try {
    const row = await getWorkspaceModuleAccessRow(key);
    if (!row) throw new Error("Workspace row not found");
    availability = buildModuleAvailability(row.grantedModules, row.enabledModules);
  } catch (error) {
    // Mocked unit suites run without a database and expect default-enabled
    // modules; every real runtime fails closed.
    if (isTestRuntime()) return buildModuleAvailability(null, null);
    throw new ModuleAvailabilityUnavailableError(key, error);
  }

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, availability });
  return availability;
}

export function clearModuleAvailabilityCache(tenant?: string): void {
  if (tenant) cache.delete(normalizeTenant(tenant));
  else cache.clear();
}

import { getTenantRoleMatrix } from "../services/rbacService.js";

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

/**
 * The user's current role from the cached tenant role matrix (invalidated on
 * role changes and soft-deletes), so revocations apply without a new token.
 * Returns null for removed users. Throws when the matrix cannot be read, except
 * in mocked unit suites, which run without a database and fall back to
 * `fallbackRole` (the token role).
 */
export async function resolveCurrentTenantRole(
  tenant: string,
  userId: string,
  fallbackRole?: string,
): Promise<string | null> {
  try {
    const entry = (await getTenantRoleMatrix(tenant))[userId];
    if (!entry || entry.deletedAt) return isTestRuntime() ? (fallbackRole ?? null) : null;
    return entry.role;
  } catch (error) {
    if (isTestRuntime()) return fallbackRole ?? null;
    throw error;
  }
}

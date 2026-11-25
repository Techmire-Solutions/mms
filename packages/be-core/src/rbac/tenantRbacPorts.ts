/**
 * App-runtime seams for the tenant RBAC reads that live in the app (they need the
 * app's repositories / request context). The app configures these once at
 * startup, so `be-core/rbac` can resolve the role matrix and the users settings
 * without importing app code.
 */
export interface TenantRoleMatrix {
  [userId: string]: { role: string; deletedAt: string | null };
}

let roleMatrixProvider: ((tenantId: string) => Promise<TenantRoleMatrix>) | null = null;
let usersSettingsProvider: ((tenantOverride?: string) => Promise<unknown>) | null = null;

export function configureTenantRoleMatrix(
  provider: (tenantId: string) => Promise<TenantRoleMatrix>,
): void {
  roleMatrixProvider = provider;
}

export function configureTenantUsersSettings(
  provider: (tenantOverride?: string) => Promise<unknown>,
): void {
  usersSettingsProvider = provider;
}

export function getTenantRoleMatrix(tenantId: string): Promise<TenantRoleMatrix> {
  if (!roleMatrixProvider) throw new Error("Tenant role matrix provider is not configured");
  return roleMatrixProvider(tenantId);
}

export function getTenantUsersSettings(tenantOverride?: string): Promise<unknown> {
  if (!usersSettingsProvider) throw new Error("Tenant users settings provider is not configured");
  return usersSettingsProvider(tenantOverride);
}

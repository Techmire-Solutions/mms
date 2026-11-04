/**
 * Request handlers shared by the dashboard contract routes.
 *
 * Every dashboard read runs in one read-only tenant transaction with a bounded
 * statement timeout; every write is permission-gated *before* the repository call
 * and runs in a write transaction so the audit row commits with the change.
 */
import { DASHBOARD_MODULE_MANIFEST, type User } from "@mms/shared";
import { withTenant } from "../../../db/tenant-context.js";
import { requireTenant } from "../../../lib/tenantContext.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";

export function canWriteDashboard(user: User): boolean {
  return (
    userHasPermission(user, DASHBOARD_MODULE_MANIFEST.permissions.setupWrite) ||
    userHasPermission(user, DASHBOARD_MODULE_MANIFEST.permissions.customize)
  );
}

export async function handleDashboardRead<T>(
  request: { log: { error: (payload: unknown, message?: string) => void } },
  action: (tenant: string) => Promise<T>,
  errorMessage: string,
) {
  try {
    const tenant = requireTenant();
    const result = await withTenant(tenant, () => action(tenant), {
      readOnly: true,
      statementTimeoutMs: 5000,
    });
    return { status: 200 as const, body: result };
  } catch (error) {
    request.log.error({ err: error }, errorMessage);
    return {
      status: 500 as const,
      body: { type: "database_error", message: errorMessage },
    };
  }
}

export type DashboardWriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { status: 403; body: { type: "forbidden"; message: string } } };

export async function handleDashboardWrite<T>(
  request: { user?: User },
  action: (user: User, tenant: string) => Promise<T>,
): Promise<DashboardWriteResult<T>> {
  const user = request.user as User;
  if (!canWriteDashboard(user)) {
    return {
      ok: false,
      error: {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      },
    };
  }
  const tenant = requireTenant();
  const data = await withTenant(tenant, () => action(user, tenant), { readOnly: false });
  return { ok: true, data };
}

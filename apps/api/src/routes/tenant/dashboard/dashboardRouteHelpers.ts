/**
 * Request handlers shared by the dashboard contract routes.
 *
 * Every dashboard read runs in one read-only tenant transaction with a bounded
 * statement timeout; every write is permission-gated *before* the repository call
 * and runs in a write transaction so the audit row commits with the change.
 */
import {
  areDashboardWidgetsDuplicate,
  findDuplicateDashboardWidget,
  DASHBOARD_MODULE_MANIFEST,
  type DashboardWidgetDto,
  type User,
} from "@mms/contracts";
import { withTenant } from "@mms/db/context";
import { requireTenant } from "../../../lib/tenantContext.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";
import {
  loadDashboardWidgets,
  upsertDashboardWidgets,
  broadcastDashboardWidgetsChanged,
} from "../../../lib/dashboardWidgetsService.js";

export function canWriteDashboard(user: User): boolean {
  // Workspace-wide board: customization requires the global settings write.
  return userHasPermission(user, DASHBOARD_MODULE_MANIFEST.permissions.setupWrite);
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

export function findDuplicateWidgetInBatch(
  incoming: DashboardWidgetDto[],
  existing: DashboardWidgetDto[],
): string | null {
  for (let i = 0; i < incoming.length; i++) {
    const widget = incoming[i];
    const duplicateInDb = findDuplicateDashboardWidget(widget, existing);
    if (duplicateInDb) {
      return "A widget with this configuration already exists on the dashboard";
    }
    for (let j = 0; j < i; j++) {
      if (areDashboardWidgetsDuplicate(widget, incoming[j])) {
        return "A widget with this configuration already exists on the dashboard";
      }
    }
  }
  return null;
}

export async function executePutWidgets(
  request: { user?: User; log: { error: (payload: unknown, message?: string) => void } },
  body: DashboardWidgetDto[],
  auditDashboard: (
    user: User,
    action: string,
    description: string,
    recordId: string,
  ) => Promise<unknown>,
) {
  try {
    const result = await handleDashboardWrite(request, async (user) => {
      const existingWidgets = await loadDashboardWidgets();
      const duplicateError = findDuplicateWidgetInBatch(body, existingWidgets);
      if (duplicateError) {
        return { kind: "duplicate" as const, message: duplicateError };
      }
      const widgets = await upsertDashboardWidgets(body);
      try {
        await auditDashboard(user, "dashboard.widgets", "Updated dashboard widgets", "widgets");
      } catch {
        /* non-critical */
      }
      return { kind: "saved" as const, widgets };
    });
    if (!result.ok) return result.error;
    if (result.data.kind === "duplicate") {
      return {
        status: 400 as const,
        body: { type: "validation_error" as const, message: result.data.message },
      };
    }
    await broadcastDashboardWidgetsChanged();
    return { status: 200 as const, body: { success: true as const, widgets: result.data.widgets } };
  } catch (err) {
    request.log.error({ err }, "Failed to save dashboard widgets");
    return {
      status: 500 as const,
      body: { type: "database_error" as const, message: "Failed to save dashboard widgets" },
    };
  }
}

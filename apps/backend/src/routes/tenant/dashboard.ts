import type { FastifyPluginAsync } from "fastify";
import {
  DASHBOARD_MODULE_MANIFEST,
  roleHasPermission,
  dashboardContract,
  normalizeDashboardPreferences,
  type DashboardPreferences,
  type DashboardWidgetDto,
  type User,
} from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { standardRequestValidationErrorHandler } from "../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../lib/contractRouterTypes.js";
import { authenticateTenant } from "../../middleware/authenticate.js";
import {
  pickReadableModuleSections,
  registerModuleAccess,
} from "../../middleware/requireTenantModule.js";
import { withTenant } from "../../db/tenant-context.js";
import { requireTenant } from "../../lib/tenantContext.js";
import { createCollectionAuditHelper } from "../../lib/createCollectionAuditHelper.js";
import {
  loadDashboardPreferences,
  saveDashboardPreferences,
} from "../../services/dashboardPreferencesService.js";
import {
  loadDashboardWidgets,
  upsertDashboardWidgets,
  deleteDashboardWidget,
  reorderDashboardWidgets,
} from "../../lib/dashboardWidgetsService.js";
import { loadDashboardSummary } from "../../services/dashboardSummaryService.js";
import { logger } from "../../lib/logger.js";

const auditDashboard = createCollectionAuditHelper("dashboard");
const s = initServer();

function canWriteDashboard(user: User): boolean {
  if (!user || !user.role) return false;
  const role = String(user.role).toLowerCase();
  return (
    roleHasPermission(role, DASHBOARD_MODULE_MANIFEST.permissions.setupWrite) ||
    roleHasPermission(role, DASHBOARD_MODULE_MANIFEST.permissions.customize)
  );
}

async function handleDashboardRead<T>(
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
  } catch {
    return {
      status: 500 as const,
      body: { type: "database_error", message: errorMessage },
    };
  }
}

type DashboardWriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { status: 403; body: { type: "forbidden"; message: string } } };

async function handleDashboardWrite<T>(
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

const dashboardRouter = s.router(dashboardContract, {
  getPreferences: async (): Promise<
    ContractRouteResponse<(typeof dashboardContract)["getPreferences"]>
  > =>
    handleDashboardRead(async () => {
      const preferences = await loadDashboardPreferences();
      return { preferences: preferences ?? normalizeDashboardPreferences(null) };
    }, "Failed to load dashboard preferences"),

  putPreferences: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof dashboardContract)["putPreferences"]>): Promise<
    ContractRouteResponse<(typeof dashboardContract)["putPreferences"]>
  > => {
    try {
      const result = await handleDashboardWrite(request, async (user) => {
        const saved = await saveDashboardPreferences(
          normalizeDashboardPreferences(body as DashboardPreferences),
        );
        try {
          await auditDashboard(
            user,
            "dashboard.preferences",
            "Updated dashboard preferences",
            "preferences",
          );
        } catch {
          /* non-critical */
        }
        return saved;
      });
      if (!result.ok) return result.error;
      return { status: 200 as const, body: { success: true, preferences: result.data } };
    } catch {
      return {
        status: 500 as const,
        body: { type: "database_error", message: "Failed to save dashboard preferences" },
      };
    }
  },

  getWidgets: async (): Promise<ContractRouteResponse<(typeof dashboardContract)["getWidgets"]>> =>
    handleDashboardRead(async () => {
      const widgets = await loadDashboardWidgets();
      return { widgets };
    }, "Failed to load dashboard widgets"),

  putWidgets: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof dashboardContract)["putWidgets"]>): Promise<
    ContractRouteResponse<(typeof dashboardContract)["putWidgets"]>
  > => {
    try {
      const result = await handleDashboardWrite(request, async (user) => {
        const widgets = await upsertDashboardWidgets(body as DashboardWidgetDto[]);
        try {
          await auditDashboard(user, "dashboard.widgets", "Updated dashboard widgets", "widgets");
        } catch {
          /* non-critical */
        }
        return widgets;
      });
      if (!result.ok) return result.error;
      return { status: 200 as const, body: { success: true, widgets: result.data } };
    } catch {
      return {
        status: 500 as const,
        body: { type: "database_error", message: "Failed to save dashboard widgets" },
      };
    }
  },

  deleteWidget: async ({
    params: { id },
    request,
  }: ContractRouteArgs<(typeof dashboardContract)["deleteWidget"]>): Promise<
    ContractRouteResponse<(typeof dashboardContract)["deleteWidget"]>
  > => {
    if (!id?.trim()) {
      return {
        status: 400 as const,
        body: { type: "validation_error", message: "Widget id is required" },
      };
    }
    try {
      const result = await handleDashboardWrite(request, async (user) => {
        await deleteDashboardWidget(id);
        try {
          await auditDashboard(
            user,
            "dashboard.widget.delete",
            `Deleted dashboard widget ${id}`,
            id,
          );
        } catch {
          /* non-critical */
        }
      });
      if (!result.ok) return result.error;
      return { status: 200 as const, body: { success: true } };
    } catch {
      return {
        status: 500 as const,
        body: { type: "database_error", message: "Failed to delete dashboard widget" },
      };
    }
  },

  reorderWidgets: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof dashboardContract)["reorderWidgets"]>): Promise<
    ContractRouteResponse<(typeof dashboardContract)["reorderWidgets"]>
  > => {
    try {
      const result = await handleDashboardWrite(request, async () => {
        await reorderDashboardWidgets(body.order);
      });
      if (!result.ok) return result.error;
      return { status: 200 as const, body: { success: true } };
    } catch {
      return {
        status: 500 as const,
        body: { type: "database_error", message: "Failed to reorder dashboard widgets" },
      };
    }
  },

  getSummary: async ({
    query,
    request,
  }: ContractRouteArgs<(typeof dashboardContract)["getSummary"]>): Promise<
    ContractRouteResponse<(typeof dashboardContract)["getSummary"]>
  > => {
    try {
      requireTenant();
      const summary = await pickReadableModuleSections(
        request,
        await loadDashboardSummary(query?.date, query?.role),
      );
      return { status: 200 as const, body: { summary: summary as Record<string, unknown> } };
    } catch (err) {
      logger.error({ err }, "Failed to load dashboard summary");
      return {
        status: 500 as const,
        body: { type: "database_error", message: "Failed to load dashboard summary" },
      };
    }
  },
} as unknown as RouterImplementation<typeof dashboardContract>);

/**
 * Server-authoritative dashboard layout/preferences + pinned widgets REST.
 * Migrated to @ts-rest contract router (Phase 3).
 */
const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "dashboard");
  await fastify.register(s.plugin(dashboardRouter), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};

export default dashboardRoutes;

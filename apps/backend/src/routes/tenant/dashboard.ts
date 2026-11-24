import type { FastifyPluginAsync } from "fastify";
import {
  dashboardContract,
  normalizeDashboardPreferences,
  type DashboardWidgetDto,
} from "@mms/contracts";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { standardRequestValidationErrorHandler } from "../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../lib/contractRouterTypes.js";
import { authenticateTenant } from "../../middleware/authenticate.js";
import {
  pickReadableModuleSections,
  registerModuleAccess,
} from "../../middleware/requireTenantModule.js";
import { requireTenant } from "../../lib/tenantContext.js";
import { createCollectionAuditHelper } from "../../lib/createCollectionAuditHelper.js";
import {
  loadDashboardPreferencesToken,
  saveDashboardPreferencesCas,
  evictDashboardPreferencesCache,
} from "../../services/dashboardPreferencesService.js";
import {
  loadDashboardWidgets,
  upsertDashboardWidgets,
  deleteDashboardWidget,
  reorderDashboardWidgets,
  broadcastDashboardWidgetsChanged,
} from "../../lib/dashboardWidgetsService.js";
import { loadDashboardSummary } from "../../services/dashboardSummaryService.js";
import { logger } from "../../lib/logger.js";
import { handleDashboardRead, handleDashboardWrite } from "./dashboard/dashboardRouteHelpers.js";

const auditDashboard = createCollectionAuditHelper("dashboard");
const s = initServer();

const dashboardRouter = s.router(dashboardContract, {
  getPreferences: async ({
    request,
  }: ContractRouteArgs<(typeof dashboardContract)["getPreferences"]>): Promise<
    ContractRouteResponse<(typeof dashboardContract)["getPreferences"]>
  > =>
    handleDashboardRead(
      request,
      async () => {
        const token = await loadDashboardPreferencesToken();
        return {
          preferences: token.preferences,
          updatedAt: token.updatedAt,
        };
      },
      "Failed to load dashboard preferences",
    ),

  putPreferences: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof dashboardContract)["putPreferences"]>): Promise<
    ContractRouteResponse<(typeof dashboardContract)["putPreferences"]>
  > => {
    try {
      const result = await handleDashboardWrite(request, async (user) => {
        const { expectedUpdatedAt, ...prefsBody } = body ?? {};
        // The write DTO declares every field optional, but the stored document
        // is a full singleton: merge the body over the stored row so a partial
        // PUT cannot reset every omitted preference to its default.
        const stored = await loadDashboardPreferencesToken();
        const merged = normalizeDashboardPreferences({
          ...(stored.preferences as unknown as Record<string, unknown>),
          ...(prefsBody as unknown as Record<string, unknown>),
        });
        // OCC: the client echoes the `updated_at` token it read; a concurrent
        // writer moves the row, so the compare-and-set misses and we refuse the
        // stale write instead of clobbering the other editor.
        const saved = await saveDashboardPreferencesCas(
          merged,
          expectedUpdatedAt ?? stored.updatedAt,
        );
        if (!saved) return { kind: "conflict" as const };
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
        return {
          kind: "saved" as const,
          preferences: saved.preferences,
          updatedAt: saved.updatedAt,
        };
      });
      if (!result.ok) return result.error;
      if (result.data.kind === "conflict") {
        return {
          status: 409 as const,
          body: {
            type: "conflict",
            message: "Dashboard preferences changed elsewhere; reload and retry",
          },
        };
      }
      // The write committed — re-evict now so a reader that repopulated the
      // cache between the in-transaction eviction and the commit cannot pin
      // the pre-commit document for the whole TTL.
      await evictDashboardPreferencesCache();
      return {
        status: 200 as const,
        body: {
          success: true,
          preferences: result.data.preferences,
          updatedAt: result.data.updatedAt,
        },
      };
    } catch (err) {
      request.log.error({ err }, "Failed to save dashboard preferences");
      return {
        status: 500 as const,
        body: { type: "database_error", message: "Failed to save dashboard preferences" },
      };
    }
  },

  getWidgets: async ({
    request,
  }: ContractRouteArgs<(typeof dashboardContract)["getWidgets"]>): Promise<
    ContractRouteResponse<(typeof dashboardContract)["getWidgets"]>
  > =>
    handleDashboardRead(
      request,
      async () => {
        const widgets = await loadDashboardWidgets();
        return { widgets };
      },
      "Failed to load dashboard widgets",
    ),

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
      await broadcastDashboardWidgetsChanged();
      return { status: 200 as const, body: { success: true, widgets: result.data } };
    } catch (err) {
      request.log.error({ err }, "Failed to save dashboard widgets");
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
      let deleted = false;
      const result = await handleDashboardWrite(request, async (user) => {
        deleted = await deleteDashboardWidget(id, user.id);
        if (!deleted) return;
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
      if (!deleted) {
        return {
          status: 404 as const,
          body: { type: "not_found", message: "Dashboard widget not found" },
        };
      }
      await broadcastDashboardWidgetsChanged();
      return { status: 200 as const, body: { success: true } };
    } catch (err) {
      request.log.error({ err, widgetId: id }, "Failed to delete dashboard widget");
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
      const result = await handleDashboardWrite(request, async (user) => {
        await reorderDashboardWidgets(body.order);
        try {
          await auditDashboard(
            user,
            "dashboard.widgets.reorder",
            `Reordered ${body.order.length} dashboard widget(s)`,
            "widgets",
          );
        } catch {
          /* non-critical */
        }
      });
      if (!result.ok) return result.error;
      await broadcastDashboardWidgetsChanged();
      return { status: 200 as const, body: { success: true } };
    } catch (err) {
      request.log.error({ err }, "Failed to reorder dashboard widgets");
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
      // `role` stays in the wire contract for the FE client but is intentionally
      // ignored: sections are filtered by the caller's authoritative permissions.
      const summary = await pickReadableModuleSections(
        request,
        await loadDashboardSummary(query?.date),
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
 *
 * Storage is **workspace-shared**, not per user: both tables are tenant
 * singletons (`dashboard_preferences` PK = workspace, `dashboard_widgets` PK =
 * workspace + id), so anyone holding `customize` (`configuration.view`, i.e.
 * settings read — admin and principal) rewrites the layout for everyone. Reads
 * are open to every authenticated member of the workspace.
 */
const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "dashboard");
  await fastify.register(s.plugin(dashboardRouter), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};

export default dashboardRoutes;

import type { DashboardWidgetDto } from "@mms/shared";
import { requireTenant } from "./tenantContext.js";
import { broadcastCollection } from "./livePush.js";
import { logger } from "./logger.js";
import {
  listDashboardWidgetsByWorkspace,
  upsertDashboardWidgetsForWorkspace,
  deleteDashboardWidgetById,
  restoreDashboardWidgetById,
  reorderDashboardWidgetsForWorkspace,
} from "../db/repositories/dashboardWidgetsRepository.js";

/** Load all dashboard widgets for the current workspace. */
export async function loadDashboardWidgets(): Promise<DashboardWidgetDto[]> {
  return listDashboardWidgetsByWorkspace(requireTenant());
}

/**
 * Bulk upsert widgets (insert + update; rows absent from the payload are
 * untouched). Returns the post-write set. The caller broadcasts *after* the
 * write transaction commits — broadcasting in-transaction lets a concurrent
 * reader repopulate the caches with pre-commit data.
 */
export async function upsertDashboardWidgets(
  widgets: DashboardWidgetDto[],
): Promise<DashboardWidgetDto[]> {
  const tenant = requireTenant();
  await upsertDashboardWidgetsForWorkspace(tenant, widgets);
  return listDashboardWidgetsByWorkspace(tenant);
}

/** Atomically reorder widgets. Caller broadcasts after commit (see above). */
export async function reorderDashboardWidgets(
  order: Array<{ id: string; sortOrder: number }>,
): Promise<void> {
  await reorderDashboardWidgetsForWorkspace(requireTenant(), order);
}

/** Soft-delete a single widget by id; false when it did not exist. Caller broadcasts after commit. */
export async function deleteDashboardWidget(id: string, deletedBy?: string): Promise<boolean> {
  const deleted = await deleteDashboardWidgetById(requireTenant(), id, deletedBy);
  return deleted > 0;
}

/** Restore a previously soft-deleted widget by id. Caller broadcasts after commit. */
export async function restoreDashboardWidget(id: string, restoredBy?: string): Promise<boolean> {
  const restored = await restoreDashboardWidgetById(requireTenant(), id, restoredBy);
  return restored > 0;
}

/** Post-commit live-update broadcast for dashboard widget config changes. */
export async function broadcastDashboardWidgetsChanged(): Promise<void> {
  try {
    await broadcastCollection("dashboard");
  } catch (err) {
    // The write already committed — a failed invalidation must not become a 500.
    logger.error({ err }, "Dashboard widget broadcast failed");
  }
}

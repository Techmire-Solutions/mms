import type { DashboardWidgetDto } from "@mms/shared";
import { requireTenant } from "./tenantContext.js";
import { broadcastCollection } from "./livePush.js";
import {
  listDashboardWidgetsByWorkspace,
  upsertDashboardWidgetsForWorkspace,
  deleteDashboardWidgetById,
  reorderDashboardWidgetsForWorkspace,
} from "../db/repositories/dashboardWidgetsRepository.js";

/** Load all dashboard widgets for the current workspace. */
export async function loadDashboardWidgets(): Promise<DashboardWidgetDto[]> {
  return listDashboardWidgetsByWorkspace(requireTenant());
}

/** Bulk upsert widgets (insert + update; rows absent from the payload are untouched). */
export async function upsertDashboardWidgets(
  widgets: DashboardWidgetDto[],
): Promise<DashboardWidgetDto[]> {
  const tenant = requireTenant();
  await upsertDashboardWidgetsForWorkspace(tenant, widgets);
  await broadcastCollection("dashboard");
  return listDashboardWidgetsByWorkspace(tenant);
}

/** Atomically reorder widgets and broadcast the change. */
export async function reorderDashboardWidgets(
  order: Array<{ id: string; sortOrder: number }>,
): Promise<DashboardWidgetDto[]> {
  const tenant = requireTenant();
  await reorderDashboardWidgetsForWorkspace(tenant, order);
  await broadcastCollection("dashboard");
  return listDashboardWidgetsByWorkspace(tenant);
}

/** Delete a single widget by id and broadcast the change. */
export async function deleteDashboardWidget(id: string): Promise<void> {
  await deleteDashboardWidgetById(requireTenant(), id);
  await broadcastCollection("dashboard");
}

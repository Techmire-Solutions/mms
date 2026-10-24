import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { DASHBOARD_WIDGET_INDEXED_KEYS, type DashboardWidgetDto } from "@mms/shared";
import { dashboardWidgets } from "../schema.js";
import { withTenant } from "../tenant-context.js";

type DashboardWidgetRow = typeof dashboardWidgets.$inferSelect;

/** Split a widget DTO into typed columns + the jsonb `config` remainder. */
function toRow(
  workspaceSubdomain: string,
  widget: DashboardWidgetDto,
  fallbackSortOrder: number,
): {
  id: string;
  workspaceSubdomain: string;
  widgetType: string | null;
  category: string;
  collection: string;
  role: string | null;
  isPinnedToDashboard: boolean;
  title: string;
  icon: string | null;
  color: string;
  operation: string;
  sortOrder: number;
  config: Record<string, unknown> | null;
  updatedAt: Date;
} {
  const config: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(widget)) {
    if (
      !DASHBOARD_WIDGET_INDEXED_KEYS.includes(key as (typeof DASHBOARD_WIDGET_INDEXED_KEYS)[number])
    ) {
      config[key] = value;
    }
  }

  return {
    id: widget.id,
    workspaceSubdomain,
    widgetType: widget.widgetType ?? null,
    category: widget.category,
    collection: widget.collection,
    role: widget.role ?? null,
    isPinnedToDashboard: widget.isPinnedToDashboard,
    title: widget.title,
    icon: widget.icon ?? null,
    color: widget.color,
    operation: widget.operation,
    sortOrder: widget.sortOrder ?? fallbackSortOrder,
    config: Object.keys(config).length > 0 ? config : null,
    updatedAt: new Date(),
  };
}

/** Merge a stored row back into a widget DTO (typed columns win, then jsonb `config`). */
function toDto(row: DashboardWidgetRow): DashboardWidgetDto {
  const config = (row.config ?? {}) as Record<string, unknown>;
  const dto: DashboardWidgetDto = {
    ...config,
    id: row.id,
    category: row.category,
    collection: row.collection,
    isPinnedToDashboard: row.isPinnedToDashboard,
    title: row.title,
    color: row.color,
    operation: row.operation as DashboardWidgetDto["operation"],
    sortOrder: row.sortOrder,
  } as DashboardWidgetDto;

  if (row.widgetType) dto.widgetType = row.widgetType as DashboardWidgetDto["widgetType"];
  if (row.role) dto.role = row.role as DashboardWidgetDto["role"];
  if (row.icon) dto.icon = row.icon as DashboardWidgetDto["icon"];

  return dto;
}

/** List all dashboard widgets for a workspace, ordered by pin order. */
export async function listDashboardWidgetsByWorkspace(
  workspaceSubdomain: string,
  options?: { limit?: number; offset?: number },
): Promise<DashboardWidgetDto[]> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const limit = Math.min(Math.max(1, options?.limit ?? 200), 500);
  const offset = Math.max(0, options?.offset ?? 0);
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: dashboardWidgets.id,
        workspaceSubdomain: dashboardWidgets.workspaceSubdomain,
        widgetType: dashboardWidgets.widgetType,
        category: dashboardWidgets.category,
        collection: dashboardWidgets.collection,
        role: dashboardWidgets.role,
        isPinnedToDashboard: dashboardWidgets.isPinnedToDashboard,
        title: dashboardWidgets.title,
        icon: dashboardWidgets.icon,
        color: dashboardWidgets.color,
        operation: dashboardWidgets.operation,
        sortOrder: dashboardWidgets.sortOrder,
        config: dashboardWidgets.config,
        updatedAt: dashboardWidgets.updatedAt,
      })
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.workspaceSubdomain, subdomain))
      .orderBy(asc(dashboardWidgets.sortOrder), asc(dashboardWidgets.id))
      .limit(limit)
      .offset(offset);
    return rows.map(toDto);
  });
}

/** Bulk upsert widgets by (workspace, id) — insert new, update existing, leave untouched rows alone. */
export async function upsertDashboardWidgetsForWorkspace(
  workspaceSubdomain: string,
  widgets: DashboardWidgetDto[],
): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  if (widgets.length === 0) return;
  // Deduplicate by widget.id: last write wins for duplicate IDs in a batch.
  // Without dedup, Postgres throws "ON CONFLICT DO UPDATE command cannot affect
  // row a second time" when the caller supplies duplicate widget IDs.
  const deduped = Array.from(
    new Map(widgets.map((w, i) => [w.id, { widget: w, index: i }])).values(),
  );
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(dashboardWidgets)
      .values(deduped.map(({ widget, index }) => toRow(subdomain, widget, index)))
      .onConflictDoUpdate({
        target: [dashboardWidgets.workspaceSubdomain, dashboardWidgets.id],
        set: {
          widgetType: sql`excluded.widget_type`,
          category: sql`excluded.category`,
          collection: sql`excluded.collection`,
          role: sql`excluded.role`,
          isPinnedToDashboard: sql`excluded.is_pinned_to_dashboard`,
          title: sql`excluded.title`,
          icon: sql`excluded.icon`,
          color: sql`excluded.color`,
          operation: sql`excluded.operation`,
          sortOrder: sql`excluded.sort_order`,
          config: sql`excluded.config`,
          updatedAt: new Date(),
        },
      });
  });
}

/** Delete a single dashboard widget by id within the workspace. */
export async function deleteDashboardWidgetById(
  workspaceSubdomain: string,
  id: string,
): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .delete(dashboardWidgets)
      .where(and(eq(dashboardWidgets.workspaceSubdomain, subdomain), eq(dashboardWidgets.id, id)));
  });
}

/** Atomically update sort_order for a list of widget ids in a single batch query. */
export async function reorderDashboardWidgetsForWorkspace(
  workspaceSubdomain: string,
  order: Array<{ id: string; sortOrder: number }>,
): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  if (order.length === 0) return;
  const now = new Date();
  // Deduplicate: last sortOrder wins for duplicate IDs; avoids inArray(ids) with dups.
  const deduped = Array.from(new Map(order.map((item) => [item.id, item])).values());
  const ids = deduped.map((item) => item.id);
  const caseStatements = deduped.map(
    (item) => sql`WHEN ${dashboardWidgets.id} = ${item.id} THEN ${item.sortOrder}`,
  );
  await withTenant(subdomain, async (tx) => {
    await tx
      .update(dashboardWidgets)
      .set({
        sortOrder: sql`CASE ${sql.join(caseStatements, sql` `)} ELSE ${dashboardWidgets.sortOrder} END`,
        updatedAt: now,
      })
      .where(
        and(eq(dashboardWidgets.workspaceSubdomain, subdomain), inArray(dashboardWidgets.id, ids)),
      );
  });
}

/** Find a single dashboard widget by id within the workspace. */
export async function findDashboardWidgetById(
  workspaceSubdomain: string,
  id: string,
): Promise<DashboardWidgetDto | null> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const cleanId = id?.trim();
  if (!cleanId) return null;
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: dashboardWidgets.id,
        workspaceSubdomain: dashboardWidgets.workspaceSubdomain,
        widgetType: dashboardWidgets.widgetType,
        category: dashboardWidgets.category,
        collection: dashboardWidgets.collection,
        role: dashboardWidgets.role,
        isPinnedToDashboard: dashboardWidgets.isPinnedToDashboard,
        title: dashboardWidgets.title,
        icon: dashboardWidgets.icon,
        color: dashboardWidgets.color,
        operation: dashboardWidgets.operation,
        sortOrder: dashboardWidgets.sortOrder,
        config: dashboardWidgets.config,
        updatedAt: dashboardWidgets.updatedAt,
      })
      .from(dashboardWidgets)
      .where(
        and(eq(dashboardWidgets.workspaceSubdomain, subdomain), eq(dashboardWidgets.id, cleanId)),
      )
      .orderBy(desc(dashboardWidgets.updatedAt))
      .limit(1);
    return rows[0] ? toDto(rows[0]) : null;
  });
}

/** Backup/restore parity — full workspace widget rows. */
export async function listAllDashboardWidgetsByWorkspace(
  workspaceSubdomain: string,
): Promise<DashboardWidgetRow[]> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    return tx
      .select({
        id: dashboardWidgets.id,
        workspaceSubdomain: dashboardWidgets.workspaceSubdomain,
        widgetType: dashboardWidgets.widgetType,
        category: dashboardWidgets.category,
        collection: dashboardWidgets.collection,
        role: dashboardWidgets.role,
        isPinnedToDashboard: dashboardWidgets.isPinnedToDashboard,
        title: dashboardWidgets.title,
        icon: dashboardWidgets.icon,
        color: dashboardWidgets.color,
        operation: dashboardWidgets.operation,
        sortOrder: dashboardWidgets.sortOrder,
        config: dashboardWidgets.config,
        updatedAt: dashboardWidgets.updatedAt,
      })
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.workspaceSubdomain, subdomain));
  });
}

/** Backup/restore parity — replace the full widget set for a workspace. */
export async function replaceDashboardWidgetsForWorkspace(
  workspaceSubdomain: string,
  records: Array<Record<string, unknown>>,
): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.delete(dashboardWidgets).where(eq(dashboardWidgets.workspaceSubdomain, subdomain));
    if (records.length === 0) return;
    const widgets = records.map((record, index) => {
      const dto = {
        id: String(record.id ?? `restore-${index}`),
        title: String(record.title ?? ""),
        category: String(record.category ?? ""),
        collection: String(record.collection ?? ""),
        operation: String(record.operation ?? "count"),
        color: String(record.color ?? ""),
        isPinnedToDashboard: Boolean(record.isPinnedToDashboard),
        ...record,
      } as DashboardWidgetDto;
      return toRow(subdomain, dto, index);
    });
    await tx.insert(dashboardWidgets).values(widgets);
  });
}

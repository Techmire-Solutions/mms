/**
 * Row ⇄ DTO mapping for `dashboard_widgets`.
 *
 * The table keeps the hot/searchable fields as typed columns and the rest of the
 * widget DTO in the `config` jsonb remainder. Kept apart from the query module so
 * both the CRUD repository and the restore path share one mapping, and so neither
 * file drifts past the size ceiling.
 */
import {
  DASHBOARD_WIDGET_INDEXED_KEYS,
  normalizeDashboardWidget,
  type DashboardWidgetDto,
} from "@mms/shared";
import type { dashboardWidgets } from "../schema.js";

export type DashboardWidgetRow = typeof dashboardWidgets.$inferSelect;

export type DashboardWidgetSelectRow = {
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
  deletedAt?: Date | null;
  deletedBy?: string | null;
  deletionReason?: string | null;
  restoredAt?: Date | null;
  restoredBy?: string | null;
  deletedWithCascade?: boolean | null;
  version?: number;
};

export type DashboardWidgetInsertRow = {
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
};

/** Split a widget DTO into typed columns + the jsonb `config` remainder. */
export function toRow(
  workspaceSubdomain: string,
  widget: DashboardWidgetDto,
  fallbackSortOrder: number,
): DashboardWidgetInsertRow {
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
export function toDto(row: DashboardWidgetSelectRow): DashboardWidgetDto {
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

/**
 * Merge a restored record into a clean DTO.
 *
 * Restore feeds raw table rows back in (typed columns plus the `config` jsonb)
 * after the collection has passed through `applyTitleCaseRecursive`, so enums can
 * arrive as `"Count"`/`"Students"`/`"Bar"`. Unwrap the nested config — otherwise
 * `toRow` stores it as a config-within-config and every chart/switch/threshold
 * setting is stranded one level deep — drop row metadata, repair the known enums
 * through the shared normalizer, and keep unknown keys for custom widgets.
 */
export function toRestoredDto(
  record: Record<string, unknown>,
  index: number,
): DashboardWidgetDto | null {
  // A corrupt backup can carry null/scalar entries; skip them instead of
  // aborting the whole restore with a destructuring TypeError.
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const {
    config: nestedConfig,
    workspaceSubdomain: _workspaceSubdomain,
    updatedAt: _updatedAt,
    ...flat
  } = record;
  const base =
    nestedConfig && typeof nestedConfig === "object" && !Array.isArray(nestedConfig)
      ? { ...(nestedConfig as Record<string, unknown>), ...flat }
      : flat;
  const rawId = base.id;
  const id = typeof rawId === "string" && rawId.trim() !== "" ? rawId.trim() : `restore-${index}`;
  const normalized = normalizeDashboardWidget({ ...base, id });
  if (!normalized) return null;
  const knownKeys = new Set(Object.keys(normalized));
  const passthrough = Object.fromEntries(
    Object.entries(base).filter(([key]) => !knownKeys.has(key)),
  );
  return { ...passthrough, ...normalized } as DashboardWidgetDto;
}

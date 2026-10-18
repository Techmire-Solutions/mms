/**
 * @file sessionsExportUtils.ts
 * @description Sessions module export utilities covering all form tabs and entity attributes.
 */
import type { Session } from "./sessionTypes.js";
import type { SessionsSettings } from "./sessionsModuleSettings.js";
import { buildExportGrid } from "../dataTransfer/export/buildExportGrid.js";
import type { ExportColumn } from "../dataTransfer/core/exportTypes.js";

export interface SessionExportColumn {
  id: string;
  label: string;
}

const SESSION_EXPORT_ALWAYS_VISIBLE = new Set(["name", "type", "status", "startDate", "endDate"]);

export const DEFAULT_SESSION_EXPORT_COLUMNS: readonly SessionExportColumn[] = [
  { id: "name", label: "Session Name" },
  { id: "type", label: "Type" },
  { id: "status", label: "Status" },
  { id: "startDate", label: "Start Date" },
  { id: "endDate", label: "End Date" },
  { id: "duration", label: "Duration" },
  { id: "baseFee", label: "Base Fee" },
  { id: "currency", label: "Currency" },
  { id: "description", label: "Description" },
  { id: "enrolled", label: "Enrolled Students" },
  { id: "capacity", label: "Capacity" },
  { id: "classesCount", label: "Classes Count" },
  { id: "classNames", label: "Classes" },
  { id: "facultyCount", label: "Faculty Count" },
  { id: "facultyNames", label: "Assigned Faculty" },
  { id: "createdAt", label: "Created At" },
  { id: "updatedAt", label: "Updated At" },
] as const;

export const ALL_SESSION_EXPORT_COLUMNS = DEFAULT_SESSION_EXPORT_COLUMNS;

/** Maps retired Setup preference `list` → Work SSOT `table`. */
export function normalizeSessionsViewLayout(layout?: string): "table" | "cards" {
  if (layout === "cards") return "cards";
  return "table";
}

/** Merges custom fields from tenant settings into the given columns. */
export function mergeCustomSessionExportColumns(
  columns: SessionExportColumn[],
  settings?: SessionsSettings | null,
): SessionExportColumn[] {
  const seen = new Set(columns.map((c) => c.id));
  const result = [...columns];
  const fields = settings?.fields;

  if (fields && typeof fields === "object" && !Array.isArray(fields)) {
    for (const [key, fieldDef] of Object.entries(fields)) {
      if (key && !seen.has(key)) {
        const def = fieldDef as { label?: string; enabled?: boolean } | undefined;
        if (def?.enabled !== false) {
          seen.add(key);
          result.push({ id: key, label: def?.label || key });
        }
      }
    }
  }
  return result;
}

/** Resolves all session export columns including tenant custom fields. */
export function resolveAllSessionExportColumns(
  settings?: SessionsSettings | null,
): SessionExportColumn[] {
  return mergeCustomSessionExportColumns([...ALL_SESSION_EXPORT_COLUMNS], settings);
}

/** Filters export columns by Sessions Setup field toggles. */
export function filterSessionExportColumnsForViewer(
  columns: SessionExportColumn[],
  settings?: SessionsSettings | null,
): SessionExportColumn[] {
  const source =
    columns.length > 0
      ? columns.length >= DEFAULT_SESSION_EXPORT_COLUMNS.length
        ? mergeCustomSessionExportColumns(columns, settings)
        : columns
      : resolveAllSessionExportColumns(settings);

  const fields = settings?.fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return source;

  return source.filter((column) => {
    if (SESSION_EXPORT_ALWAYS_VISIBLE.has(column.id)) return true;
    const fieldDef = fields[column.id] as { enabled?: boolean } | undefined;
    if (fieldDef && fieldDef.enabled === false) return false;
    return true;
  });
}

/** Pure cell extractor for Session entities. */
export function extractSessionCell(session: Session, columnId: string): string | number | null {
  if (columnId === "name") return session.name || "";
  if (columnId === "type") return session.type || "";
  if (columnId === "status") return session.status || "";
  if (columnId === "startDate") return session.startDate || "";
  if (columnId === "endDate") return session.endDate || "";
  if (columnId === "baseFee") return session.baseFee != null ? String(session.baseFee) : "";
  if (columnId === "currency") return session.currency || "";
  if (columnId === "description") return session.description || "";
  if (columnId === "duration") {
    const start = session.startDate || "";
    const end = session.endDate || "";
    return start && end ? `${start} → ${end}` : start || end;
  }
  if (columnId === "enrolled") {
    const classes = session.classes ?? [];
    return String(classes.reduce((sum, cls) => sum + (cls.enrolled ?? 0), 0));
  }
  if (columnId === "capacity") {
    const classes = session.classes ?? [];
    return String(classes.reduce((sum, cls) => sum + (cls.maxStudents ?? 0), 0));
  }
  if (columnId === "classesCount") return String((session.classes ?? []).length);
  if (columnId === "classNames") {
    return (session.classes ?? [])
      .map((c) => c.name)
      .filter(Boolean)
      .join("; ");
  }
  if (columnId === "facultyCount") return String((session.faculty ?? []).length);
  if (columnId === "facultyNames") {
    return (session.faculty ?? [])
      .map((f) => f.facultyName || f.facultyId)
      .filter(Boolean)
      .join("; ");
  }
  if (columnId === "createdAt") return session.createdAt ? String(session.createdAt) : "";
  if (columnId === "updatedAt") return session.updatedAt ? String(session.updatedAt) : "";

  const propKey = columnId.startsWith("custom:") ? columnId.slice("custom:".length) : columnId;
  const customObj = (session as { customFields?: Record<string, unknown> }).customFields;
  const value = session[propKey as keyof Session] ?? customObj?.[propKey] ?? customObj?.[columnId];
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join("; ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Builds a 2D grid [header, ...rows] for the given sessions and columns. */
export function buildSessionsExportRows(
  sessions: Session[],
  columns: SessionExportColumn[],
): unknown[][] {
  return buildExportGrid(sessions, columns as ExportColumn[], extractSessionCell);
}

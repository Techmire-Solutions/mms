import {
  ATTENDANCE_LOOKUP_KINDS,
  ATTENDANCE_RECORD_STATUSES,
  defaultAttendanceLookupItems,
  emptyAttendanceLookupsMap,
  normalizeAttendanceModulePreferences,
  type AttendanceLookupKind,
  type AttendanceLookupsMap,
  type AttendanceRecordStatus,
  type AttendanceStatus,
} from "@mms/shared";
import { getRequestTenant } from "../lib/tenantContext.js";
import { broadcastCollection } from "../lib/livePush.js";
import {
  listAttendanceLookupsByWorkspace,
  replaceAttendanceLookupsForKind,
} from "../db/repositories/attendanceLookupsRepository.js";
import { getAttendanceModulePreferences } from "../db/repositories/attendanceModulePreferencesRepository.js";
import { logger } from "../lib/logger.js";
import { HttpDomainError } from "../lib/httpErrors.js";

/**
 * A lookup row may only carry a status id from the canonical domain; a legacy/custom id would be
 * rejected by `attendance_status_check` the first time a mark used it. Unknown ids are dropped on
 * read (logged) so one bad row cannot break the grid.
 */
function canonicalStatusId(id: string): AttendanceRecordStatus | null {
  return (ATTENDANCE_RECORD_STATUSES as readonly string[]).includes(id)
    ? (id as AttendanceRecordStatus)
    : null;
}

/** `half_day` is offered only when the tenant enables half-day tracking. */
function includeHalfDay(trackHalfDay: boolean, statusId: AttendanceRecordStatus): boolean {
  return statusId !== "half_day" || trackHalfDay;
}

type LookupDbRow = {
  id: string;
  kind: string;
  label: string;
  meta: Record<string, unknown> | null;
  sortOrder: number;
};

function rowsToAttendanceStatuses(
  rows: LookupDbRow[],
  options: { trackHalfDay: boolean },
): AttendanceStatus[] {
  const seen = new Set<string>();
  const statuses: AttendanceStatus[] = [];
  for (const row of rows) {
    const lastColon = row.id.lastIndexOf(":");
    const raw = lastColon >= 0 ? row.id.slice(lastColon + 1) : row.id;
    const id = canonicalStatusId(raw);
    if (!id) {
      logger.warn({ id: raw, kind: row.kind }, "Dropping attendance status lookup with unknown id");
      continue;
    }
    if (!includeHalfDay(options.trackHalfDay, id) || seen.has(id)) continue;
    seen.add(id);
    statuses.push({
      id,
      label: row.label,
      short:
        typeof row.meta?.short === "string" ? row.meta.short : row.label.charAt(0).toUpperCase(),
      color: typeof row.meta?.color === "string" ? row.meta.color : "muted",
      bg: typeof row.meta?.bg === "string" ? row.meta.bg : "bg-muted",
      text: typeof row.meta?.text === "string" ? row.meta.text : "text-muted-foreground",
      border: typeof row.meta?.border === "string" ? row.meta.border : "border-border",
      dot: typeof row.meta?.dot === "string" ? row.meta.dot : "bg-muted-foreground",
    });
  }
  return statuses;
}

export async function loadAttendanceLookupsMap(
  tenant = getRequestTenant(),
): Promise<AttendanceLookupsMap> {
  const empty = emptyAttendanceLookupsMap;
  if (!tenant) return empty;

  const rows = await listAttendanceLookupsByWorkspace(tenant);
  const byKind = new Map<string, LookupDbRow[]>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let list = byKind.get(row.kind);
    if (!list) {
      list = [];
      byKind.set(row.kind, list);
    }
    list.push(row);
  }

  const preferences = normalizeAttendanceModulePreferences(
    await getAttendanceModulePreferences(tenant),
  );
  const options = { trackHalfDay: preferences.trackHalfDay === true };
  const result = { ...empty };
  for (const kind of ATTENDANCE_LOOKUP_KINDS) {
    const kindRows = byKind.get(kind) ?? [];
    const source =
      kindRows.length === 0
        ? defaultAttendanceLookupItems[kind]
        : rowsToAttendanceStatuses(kindRows, options);
    result[kind] = source.filter((status) => includeHalfDay(options.trackHalfDay, status.id));
  }
  return result;
}

export async function replaceAttendanceLookupKind(
  kind: AttendanceLookupKind,
  items: AttendanceStatus[],
  tenant = getRequestTenant(),
): Promise<AttendanceStatus[]> {
  if (!tenant) throw new Error("Tenant context required");

  const preferences = normalizeAttendanceModulePreferences(
    await getAttendanceModulePreferences(tenant),
  );
  const halfDayRequested = items.some((item) => item.id === "half_day");
  if (halfDayRequested && preferences.trackHalfDay !== true) {
    throw new HttpDomainError(
      422,
      "attendance_half_day_disabled",
      "Half-day tracking is disabled for this school — enable it in Setup before adding a half-day status",
    );
  }

  await replaceAttendanceLookupsForKind(
    tenant,
    kind,
    items.map((item, index) => ({
      id: `${tenant}:${kind}:${item.id}`,
      kind,
      label: item.label,
      meta: {
        short: item.short,
        color: item.color,
        bg: item.bg,
        text: item.text,
        border: item.border,
        dot: item.dot,
      },
      sortOrder: index,
    })),
  );
  await broadcastCollection("attendance_records"); // Broadcast to the main attendance channel
  return items;
}

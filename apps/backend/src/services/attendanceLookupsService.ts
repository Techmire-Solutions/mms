import {
  ATTENDANCE_LOOKUP_KINDS,
  defaultAttendanceLookupItems,
  emptyAttendanceLookupsMap,
  type AttendanceLookupKind,
  type AttendanceLookupsMap,
  type AttendanceStatus,
} from "@mms/shared";
import { getRequestTenant } from "../lib/tenantContext.js";
import { broadcastCollection } from "../lib/livePush.js";
import {
  listAttendanceLookupsByWorkspace,
  replaceAttendanceLookupsForKind,
} from "../db/repositories/attendanceLookupsRepository.js";

type LookupDbRow = {
  id: string;
  kind: string;
  label: string;
  meta: Record<string, unknown> | null;
  sortOrder: number;
};

function rowsToAttendanceStatuses(rows: LookupDbRow[]): AttendanceStatus[] {
  return rows.map((row) => {
    const lastColon = row.id.lastIndexOf(":");
    const id = lastColon >= 0 ? row.id.slice(lastColon + 1) : row.id;
    return {
      id,
      label: row.label,
      short:
        typeof row.meta?.short === "string" ? row.meta.short : row.label.charAt(0).toUpperCase(),
      color: typeof row.meta?.color === "string" ? row.meta.color : "muted",
      bg: typeof row.meta?.bg === "string" ? row.meta.bg : "bg-muted",
      text: typeof row.meta?.text === "string" ? row.meta.text : "text-muted-foreground",
      border: typeof row.meta?.border === "string" ? row.meta.border : "border-border",
      dot: typeof row.meta?.dot === "string" ? row.meta.dot : "bg-muted-foreground",
    };
  });
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

  const result = { ...empty };
  for (const kind of ATTENDANCE_LOOKUP_KINDS) {
    const kindRows = byKind.get(kind) ?? [];
    if (kindRows.length === 0) {
      result[kind] = defaultAttendanceLookupItems[kind];
      continue;
    }
    result[kind] = rowsToAttendanceStatuses(kindRows);
  }
  return result;
}

export async function replaceAttendanceLookupKind(
  kind: AttendanceLookupKind,
  items: AttendanceStatus[],
  tenant = getRequestTenant(),
): Promise<AttendanceStatus[]> {
  if (!tenant) throw new Error("Tenant context required");

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

import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
} from "@mms/shared";
import { getCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import { bulkSaveAttendanceRecords } from "../repositories/attendanceRepository.js";
import type { AttendanceRecord } from "@mms/shared";

async function discoverTenantSubdomains(): Promise<Set<string>> {
  const subdomains = new Set<string>();
  const names = await listCollectionStorageNames();
  for (const name of names) {
    const parsed = parseTenantScopedStorageKey(name);
    if (parsed) subdomains.add(parsed.subdomain);
  }
  const workspaces = await getCollectionByStorageName(WORKSPACES_COLLECTION);
  if (Array.isArray(workspaces)) {
    for (const entry of workspaces) {
      const subdomain = (entry as Workspace).subdomain;
      if (subdomain) subdomains.add(subdomain);
    }
  }
  return subdomains;
}

export async function runMigration025(): Promise<void> {
  let changed = false;
  const subdomains = await discoverTenantSubdomains();

  for (const subdomain of subdomains) {
    const attendanceKey = `${tenantCollectionKey(subdomain, "")}attendance_records`;
    const legacyAttendance = await getCollectionByStorageName(attendanceKey);
    if (!Array.isArray(legacyAttendance) || legacyAttendance.length === 0) continue;

    const attendanceList = legacyAttendance as AttendanceRecord[];
    await bulkSaveAttendanceRecords(subdomain, attendanceList);
    changed = true;
    console.log(
      `[Migration 025] Imported ${attendanceList.length} attendance record(s) for "${subdomain}" into attendance table.`,
    );
  }

  if (!changed) {
    console.log("[Migration 025] No legacy attendance records to import.");
  }
}

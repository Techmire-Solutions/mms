import {
  emptyAttendanceLookupsMap,
  type AttendanceLookupKind,
  type AttendanceLookupsMap,
  type AttendanceStatus,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { createModuleLookupsHooks } from "@/lib/query/createModuleLookupsHooks";
import { attendanceQueryKeys } from "./attendanceQueryKeys.js";

export const ATTENDANCE_LOOKUPS_QUERY_KEY = attendanceQueryKeys.lookups;

export async function fetchAttendanceLookups(_signal?: AbortSignal): Promise<AttendanceLookupsMap> {
  const res = await apiContract.attendance.getLookups({ query: undefined, extraHeaders: {} });
  return (res.body as { lookups?: AttendanceLookupsMap }).lookups ?? emptyAttendanceLookupsMap;
}

export async function putAttendanceLookupKind(
  kind: AttendanceLookupKind,
  items: AttendanceStatus[],
): Promise<AttendanceStatus[]> {
  const res = await apiContract.attendance.updateLookupKind({
    params: { kind },
    body: { items },
    query: undefined,
    extraHeaders: {},
  });
  return (res.body as { items?: AttendanceStatus[] }).items ?? [];
}

const lookupsHooks = createModuleLookupsHooks<
  AttendanceLookupsMap,
  AttendanceLookupKind,
  AttendanceStatus[]
>({
  queryKey: ATTENDANCE_LOOKUPS_QUERY_KEY,
  fetchLookups: fetchAttendanceLookups,
  putLookupKind: putAttendanceLookupKind,
  defaults: () => emptyAttendanceLookupsMap,
});

export const useAttendanceLookupsQuery = lookupsHooks.useLookupsQuery;
export const useAttendanceLookupMutation = lookupsHooks.useLookupMutation;

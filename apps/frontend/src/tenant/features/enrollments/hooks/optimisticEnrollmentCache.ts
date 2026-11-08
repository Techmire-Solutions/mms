import type { QueryClient } from "@tanstack/react-query";
import type { EnrollmentStatus } from "@mms/shared";
import { ENROLLMENTS_QUERY_KEY } from "./enrollmentsQueryKeys.js";

type Row = { id?: unknown; status?: unknown } & Record<string, unknown>;

/** Patch enrollment rows in every known cache shape (tsr envelope, bare page, array, detail). */
export function patchEnrollmentStatuses(
  data: unknown,
  ids: ReadonlySet<string>,
  status: EnrollmentStatus,
): unknown {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    return data.map((row) => patchRow(row, ids, status));
  }
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.enrollments)) {
    return { ...record, enrollments: record.enrollments.map((row) => patchRow(row, ids, status)) };
  }
  if (record.body && typeof record.body === "object") {
    return { ...record, body: patchEnrollmentStatuses(record.body, ids, status) };
  }
  if (typeof record.id === "string" && ids.has(record.id)) {
    return { ...record, status };
  }
  return data;
}

function patchRow(row: unknown, ids: ReadonlySet<string>, status: EnrollmentStatus): unknown {
  if (!row || typeof row !== "object") return row;
  const value = row as Row;
  return typeof value.id === "string" && ids.has(value.id) ? { ...value, status } : row;
}

export interface OptimisticEndContext {
  snapshots: Array<[readonly unknown[], unknown]>;
}

/** Cancel in-flight list reads, snapshot, then patch the affected rows optimistically. */
export async function optimisticEndEnrollments(
  queryClient: QueryClient,
  ids: readonly string[],
  status: Extract<EnrollmentStatus, "withdrawn" | "cancelled">,
): Promise<OptimisticEndContext> {
  const idSet = new Set(ids);
  await queryClient.cancelQueries({ queryKey: ENROLLMENTS_QUERY_KEY });
  const snapshots = queryClient.getQueriesData({ queryKey: ENROLLMENTS_QUERY_KEY });
  for (const [key, data] of snapshots) {
    queryClient.setQueryData(key, patchEnrollmentStatuses(data, idSet, status));
  }
  return { snapshots };
}

/** Restore every snapshot taken by `optimisticEndEnrollments` (server rejected the write). */
export function rollbackEnrollmentSnapshots(
  queryClient: QueryClient,
  context: OptimisticEndContext | undefined,
): void {
  for (const [key, data] of context?.snapshots ?? []) {
    queryClient.setQueryData(key, data);
  }
}

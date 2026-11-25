import { useQueryClient } from "@tanstack/react-query";
import type { AttendanceRecord } from "@/lib/data/attendanceData";
import { invalidateAttendanceQueries } from "@/tenant/features/attendance/hooks/invalidateAttendanceQueries";
import { attendanceQueryKeys } from "@/tenant/features/attendance/hooks/attendanceQueryKeys.js";
import { tsrClient } from "@mms/fe-core/api/tsRest";

export function patchAttendanceCachedRecords(
  cached: unknown,
  patch: (records: AttendanceRecord[]) => AttendanceRecord[],
): unknown {
  if (!cached || typeof cached !== "object") return cached;
  const container = cached as {
    records?: AttendanceRecord[];
    body?: { records?: AttendanceRecord[] };
  };
  let changed = false;
  let next: { records?: AttendanceRecord[]; body?: { records?: AttendanceRecord[] } } = container;
  if (Array.isArray(container.records)) {
    next = { ...next, records: patch(container.records) };
    changed = true;
  }
  if (container.body && Array.isArray(container.body.records)) {
    next = { ...next, body: { ...container.body, records: patch(container.body.records) } };
    changed = true;
  }
  return changed ? next : cached;
}

export function useAttendanceMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    invalidateAttendanceQueries(queryClient);
  };

  /** Bulk upsert. The legacy name is retained for callers while the endpoint remains PUT /bulk. */
  const bulkUpsert = tsrClient.attendance.bulk.useMutation({
    onMutate: async (variables: {
      body?: AttendanceRecord[] | { records?: AttendanceRecord[] };
    }) => {
      const raw = variables.body;
      const incoming = Array.isArray(raw) ? raw : (raw?.records ?? []);
      if (incoming.length === 0) return undefined;
      await queryClient.cancelQueries({ queryKey: attendanceQueryKeys.all });
      const snapshot = queryClient.getQueriesData({ queryKey: attendanceQueryKeys.all });
      queryClient.setQueriesData({ queryKey: attendanceQueryKeys.all }, (cached: unknown) =>
        patchAttendanceCachedRecords(cached, (records) =>
          records.map((record) => {
            const replacement = incoming.find(
              (candidate) =>
                candidate.id === record.id ||
                (candidate.classId === record.classId &&
                  candidate.date === record.date &&
                  candidate.studentId === record.studentId),
            );
            return replacement ? { ...record, ...replacement } : record;
          }),
        ),
      );
      return { snapshot };
    },
    onError: (
      _error: unknown,
      _variables: unknown,
      context: { snapshot?: Array<[readonly unknown[], unknown]> } | undefined,
    ) => {
      for (const [key, value] of context?.snapshot ?? []) queryClient.setQueryData(key, value);
    },
    onSettled: invalidate,
  });

  const createRecord = tsrClient.attendance.create.useMutation({
    onSuccess: invalidate,
  });

  /**
   * Single-record update with an optimistic patch and a real rollback.
   *
   * The batch save stays authoritative (the server returns the persisted rows), but a drawer edit or
   * status toggle is a one-row write the UI can show immediately: snapshot every cached list/roster
   * page, patch the row, restore on failure.
   */
  const updateRecord = tsrClient.attendance.update.useMutation({
    onMutate: async (variables: { body?: Partial<AttendanceRecord> }) => {
      const { id, ...patch } = (variables.body ?? {}) as AttendanceRecord & { id: string };
      await queryClient.cancelQueries({ queryKey: attendanceQueryKeys.all });
      const snapshot = queryClient.getQueriesData({ queryKey: attendanceQueryKeys.all });
      queryClient.setQueriesData({ queryKey: attendanceQueryKeys.all }, (cached: unknown) =>
        patchAttendanceCachedRecords(cached, (records) =>
          records.map((record) => (record.id === id ? { ...record, ...patch } : record)),
        ),
      );
      return { snapshot };
    },
    onError: (
      _error: unknown,
      _variables: unknown,
      context: { snapshot?: Array<[readonly unknown[], unknown]> } | undefined,
    ) => {
      const snapshot = (context as { snapshot?: Array<[readonly unknown[], unknown]> } | undefined)
        ?.snapshot;
      for (const [key, value] of snapshot ?? []) queryClient.setQueryData(key, value);
    },
    onSettled: invalidate,
  });

  const deleteRecord = tsrClient.attendance.delete.useMutation({
    onSuccess: invalidate,
  });

  const restoreRecord = tsrClient.attendance.restore.useMutation({
    onSuccess: invalidate,
  });

  const bulkDeleteRecords = tsrClient.attendance.bulkDelete.useMutation({
    onSuccess: invalidate,
  });

  const bulkRestoreRecords = tsrClient.attendance.bulkRestore.useMutation({
    onSuccess: invalidate,
  });

  const submitDay = tsrClient.attendance.submitDay.useMutation({ onSuccess: invalidate });
  const reopenDay = tsrClient.attendance.reopenDay.useMutation({ onSuccess: invalidate });

  return {
    bulkUpsert,
    replaceAll: bulkUpsert,
    createRecord,
    updateRecord,
    deleteRecord,
    restoreRecord,
    bulkDeleteRecords,
    bulkRestoreRecords,
    submitDay,
    reopenDay,
  };
}

// --- Contract-driven list queryOptions & mutation hooks ----------------------

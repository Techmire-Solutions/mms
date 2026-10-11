import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { ModuleCustomField } from "@mms/shared";
import { notify } from "@/lib/notify";
import {
  addAuditEntry,
  loadQueue,
  saveQueue,
} from "@/tenant/features/attendance/components/markAttendanceQueue";
import {
  attendanceRecordsFromRows,
  buildOfflinePayload,
} from "@/tenant/features/attendance/components/markAttendanceRowUtils";
import type {
  AttendanceRow,
  GeoData,
  OfflinePayload,
} from "@/tenant/features/attendance/components/markAttendanceTypes";
import type { AttendanceRecord } from "@/lib/data/attendanceData";

export interface UseMarkAttendancePersistenceOptions {
  filters: { classId: string; date: string };
  role: string;
  rows: AttendanceRow[];
  geo: GeoData | "loading" | null;
  isOffline: boolean;
  offlineQueue: OfflinePayload[];
  setOfflineQueue: Dispatch<SetStateAction<OfflinePayload[]>>;
  setIsDraft: (draft: boolean) => void;
  setSubmitted: (submitted: boolean) => void;
  setSyncedMsg: (synced: boolean) => void;
  customFields: ModuleCustomField[];
  persistBatch: (records: AttendanceRecord[]) => Promise<void>;
}

export function useMarkAttendancePersistence({
  filters,
  role,
  rows,
  geo,
  isOffline,
  offlineQueue,
  setOfflineQueue,
  setIsDraft,
  setSubmitted,
  setSyncedMsg,
  customFields,
  persistBatch,
}: UseMarkAttendancePersistenceOptions) {
  const { t } = useTranslation();

  const buildRecords = useCallback(
    (
      attendanceRows: AttendanceRow[],
      classId = filters.classId,
      date = filters.date,
    ): AttendanceRecord[] => attendanceRecordsFromRows(attendanceRows, customFields, classId, date),
    [customFields, filters.classId, filters.date],
  );

  const queueOfflinePayload = useCallback(
    (payload: OfflinePayload) => {
      const nextQueue = [
        ...offlineQueue.filter(
          (queued) => !(queued.classId === payload.classId && queued.date === payload.date),
        ),
        payload,
      ];
      saveQueue(nextQueue);
      setOfflineQueue(nextQueue);
    },
    [offlineQueue, setOfflineQueue],
  );

  const currentOfflinePayload = useCallback(
    (): OfflinePayload =>
      buildOfflinePayload(
        filters.classId,
        filters.date,
        rows,
        typeof geo === "object" ? geo : null,
        role,
      ),
    [filters.classId, filters.date, geo, role, rows],
  );

  const handleSaveDraft = async () => {
    if (isOffline) {
      queueOfflinePayload(currentOfflinePayload());
      setIsDraft(true);
      addAuditEntry(filters.classId, filters.date, { action: "draft_saved", by: role });
      return;
    }

    try {
      await persistBatch(buildRecords(rows));
      setIsDraft(true);
      addAuditEntry(filters.classId, filters.date, { action: "draft_saved", by: role });
      notify.success(t("attendance.toast.draftSaved"));
    } catch (error) {
      notify.error(t("attendance.toast.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleSubmit = async () => {
    const payload = currentOfflinePayload();
    if (isOffline) {
      queueOfflinePayload(payload);
      setSubmitted(true);
      addAuditEntry(filters.classId, filters.date, {
        action: "submitted",
        count: rows.length,
        by: role,
        geo: payload.geo,
      });
      return;
    }

    try {
      await persistBatch(buildRecords(rows));
      setSubmitted(true);
      addAuditEntry(filters.classId, filters.date, {
        action: "submitted",
        count: rows.length,
        by: role,
        geo: payload.geo,
      });
      notify.success(t("attendance.toast.submitted"));
    } catch (error) {
      notify.error(t("attendance.toast.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleSync = async () => {
    if (isOffline) return;

    try {
      const queuedRecords = offlineQueue.flatMap((payload) =>
        buildRecords(payload.rows, payload.classId, payload.date),
      );
      await persistBatch(queuedRecords);
      saveQueue([]);
      setOfflineQueue([]);
      setSyncedMsg(true);
      setTimeout(() => setSyncedMsg(false), 3000);
    } catch (error) {
      notify.error(t("attendance.toast.syncFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return { handleSaveDraft, handleSubmit, handleSync };
}

export { loadQueue };

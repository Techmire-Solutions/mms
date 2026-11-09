import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { ModuleCustomField } from "@mms/shared";
import { notify } from "@/lib/notify";
import {
  addAuditEntry,
  loadQueue,
  saveQueue,
} from "@/tenant/features/attendance/lib/markAttendanceQueue";
import {
  attendanceRecordsFromRows,
  buildOfflinePayload,
} from "@/tenant/features/attendance/lib/markAttendanceRowUtils";
import type {
  AttendanceRow,
  GeoData,
  OfflinePayload,
} from "@/tenant/features/attendance/lib/markAttendanceTypes";
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
  persistBatch: (records: AttendanceRecord[], overrideReason?: string) => Promise<void>;
  onOverrideRequired?: (
    records: AttendanceRecord[],
    retry: (reason: string) => Promise<void>,
  ) => void;
}

/** True when the API refused the save because it needs an override justification. */
function isOverrideReasonRequired(error: unknown): boolean {
  const candidate = error as { body?: { type?: string }; type?: string; message?: string };
  return (
    candidate?.body?.type === "attendance_override_reason_required" ||
    candidate?.type === "attendance_override_reason_required" ||
    (typeof candidate?.message === "string" &&
      candidate.message.includes("attendance_override_reason_required"))
  );
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
  onOverrideRequired,
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

    await saveWithIntent("draft");
  };

  /**
   * Saves with an optional override justification, then applies the action's success effects.
   *
   * When the API refuses the save because it needs a justification, the page is asked to collect one
   * and the same intent is retried — so a locked/past day is not a dead end.
   */
  const saveWithIntent = async (
    intent: "draft" | "submit",
    overrideReason?: string,
  ): Promise<void> => {
    const payload = currentOfflinePayload();
    try {
      await persistBatch(buildRecords(rows), overrideReason);
      if (intent === "draft") {
        setIsDraft(true);
        addAuditEntry(filters.classId, filters.date, { action: "draft_saved", by: role });
        notify.success(t("attendance.toast.draftSaved"));
        return;
      }
      setSubmitted(true);
      addAuditEntry(filters.classId, filters.date, {
        action: "submitted",
        count: rows.length,
        by: role,
        geo: payload.geo,
      });
      notify.success(t("attendance.toast.submitted"));
    } catch (error) {
      if (!overrideReason && isOverrideReasonRequired(error) && onOverrideRequired) {
        onOverrideRequired(buildRecords(rows), (reason) => saveWithIntent(intent, reason));
        return;
      }
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

    await saveWithIntent("submit");
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

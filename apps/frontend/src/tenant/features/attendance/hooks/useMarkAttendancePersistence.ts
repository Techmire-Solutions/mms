import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { flushAuditQueue } from "@/tenant/features/attendance/lib/markAttendanceQueue";
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
  persistBatch: (
    records: AttendanceRecord[],
    overrideReason?: string,
  ) => Promise<AttendanceRecord[]>;
  onOverrideRequired?: (
    records: AttendanceRecord[],
    retry: (reason: string) => Promise<void>,
  ) => void;
  /** Adopt the server's persisted rows (ids + OCC versions) after a save. */
  onPersisted?: (records: AttendanceRecord[]) => void;
  /** Submit hook: persist marks, then lock the day server-side. */
  onSubmitDay?: (classId: string, date: string) => Promise<unknown>;
  /** Row-level validation/server failures, surfaced against the grid instead of a flat toast. */
  onRowErrors?: (errors: Array<{ studentId?: string; message: string }>) => void;
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
  onPersisted,
  onSubmitDay,
  onRowErrors,
}: UseMarkAttendancePersistenceOptions) {
  const [saving, setSaving] = useState(false);
  // Ref guard: state disables the buttons only after a re-render.
  const inFlightRef = useRef(false);
  // "Synced" toast timer, cleared on unmount so it never fires after the grid is gone.
  const syncedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();

  useEffect(
    () => () => {
      if (syncedTimerRef.current !== null) clearTimeout(syncedTimerRef.current);
    },
    [],
  );

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
   * Client-side checks the policy would reject anyway.
   *
   * `late`/`half_day` need a valid time-in and a time-out cannot precede it; catching these before the
   * request avoids a round trip and points at the offending row instead of a flattened message.
   */
  const validateRows = (): Array<{ studentId?: string; message: string }> => {
    const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
    const errors: Array<{ studentId?: string; message: string }> = [];
    for (const row of rows) {
      if (row.timeIn && !HHMM.test(row.timeIn)) {
        errors.push({ studentId: row.studentId, message: `${row.name}: invalid time-in` });
        continue;
      }
      if (row.timeOut && !row.timeIn) {
        errors.push({
          studentId: row.studentId,
          message: `${row.name}: a time-out needs a time-in`,
        });
        continue;
      }
      if (row.status === "late" || row.status === "half_day") {
        if (!HHMM.test(row.timeIn)) {
          errors.push({
            studentId: row.studentId,
            message: `${row.name}: a ${row.status.replace("_", " ")} needs a time-in (HH:mm)`,
          });
          continue;
        }
      }
      if (HHMM.test(row.timeIn) && row.timeOut && !HHMM.test(row.timeOut)) {
        errors.push({ studentId: row.studentId, message: `${row.name}: invalid time-out` });
        continue;
      }
      if (HHMM.test(row.timeIn) && HHMM.test(row.timeOut) && row.timeOut < row.timeIn) {
        errors.push({
          studentId: row.studentId,
          message: `${row.name}: time-out is before time-in`,
        });
      }
    }
    return errors;
  };

  const extractServerRowErrors = (
    error: unknown,
  ): Array<{ studentId?: string; message: string }> => {
    const candidate = error as {
      body?: { errors?: Array<{ studentId?: string; message?: string }> };
      errors?: Array<{ studentId?: string; message?: string }>;
    };
    const raw = candidate?.body?.errors ?? candidate?.errors;
    if (!Array.isArray(raw)) return [];
    return raw.map((entry) => ({
      ...(entry.studentId ? { studentId: String(entry.studentId) } : {}),
      message: String(entry.message ?? ""),
    }));
  };

  const saveWithIntent = async (
    intent: "draft" | "submit",
    overrideReason?: string,
  ): Promise<void> => {
    const payload = currentOfflinePayload();
    const validationErrors = validateRows();
    if (validationErrors.length > 0) {
      onRowErrors?.(validationErrors);
      notify.error(t("attendance.mark.validationTitle"), {
        description: validationErrors[0]?.message,
      });
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSaving(true);
    try {
      const persisted = await persistBatch(buildRecords(rows), overrideReason);
      onRowErrors?.([]);
      flushAuditQueue();
      onPersisted?.(persisted ?? []);
      if (intent === "draft") {
        setIsDraft(true);
        addAuditEntry(filters.classId, filters.date, { action: "draft_saved", by: role });
        notify.success(t("attendance.toast.draftSaved"));
        return;
      }
      // Submitting marks then locks the roster day: without this call the server-side day
      // submission (and therefore `lockAfterSubmit`) could never be engaged from the UI.
      if (onSubmitDay && filters.classId && filters.date) {
        await onSubmitDay(filters.classId, filters.date);
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
      const serverRowErrors = extractServerRowErrors(error);
      if (serverRowErrors.length > 0) onRowErrors?.(serverRowErrors);
      if (!overrideReason && isOverrideReasonRequired(error) && onOverrideRequired) {
        onOverrideRequired(buildRecords(rows), (reason) => saveWithIntent(intent, reason));
        return;
      }
      notify.error(t("attendance.toast.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      inFlightRef.current = false;
      setSaving(false);
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
      if (syncedTimerRef.current !== null) clearTimeout(syncedTimerRef.current);
      syncedTimerRef.current = setTimeout(() => setSyncedMsg(false), 3000);
    } catch (error) {
      notify.error(t("attendance.toast.syncFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return { saving, handleSaveDraft, handleSubmit, handleSync };
}

export { loadQueue };

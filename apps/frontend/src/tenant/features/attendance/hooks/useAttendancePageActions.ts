import { useTranslation } from "@/hooks/useTranslation";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { notify } from "@/lib/notify";
import type { AttendanceRecord } from "@/lib/data/attendanceData";
import { useAttendanceMutations } from "@/tenant/features/attendance/hooks/useAttendance";
import { toMessagingRecipient } from "@mms/shared";

export function useAttendancePageActions() {
  const { t } = useTranslation();
  const {
    bulkUpsert,
    updateRecord,
    deleteRecord,
    restoreRecord,
    bulkDeleteRecords,
    bulkRestoreRecords,
    submitDay,
    reopenDay,
  } = useAttendanceMutations();
  const { messagingTarget, openComposer, closeComposer } = useMessageComposerState();

  const handleMessageAttendance = (
    channel: "sms" | "whatsapp" | "email",
    attRecords: AttendanceRecord[],
  ) => {
    openComposer(
      channel,
      attRecords.map((record) =>
        toMessagingRecipient({
          id: record.studentId || record.id,
          name: record.studentName || t("attendance.messaging.student"),
          phone:
            typeof (record as { phone?: string }).phone === "string"
              ? (record as { phone?: string }).phone
              : "",
          email:
            typeof (record as { email?: string }).email === "string"
              ? (record as { email?: string }).email
              : "",
        }),
      ),
    );
  };

  /**
   * Saves the roster and **returns the persisted rows**.
   *
   * The grid must adopt the server ids/versions it just received; otherwise its next save carries a
   * stale token (or none at all) and the optimistic-concurrency guard can never fire.
   */
  const persistRecords = async (
    recordsForClassDate: AttendanceRecord[],
    overrideReason?: string,
  ): Promise<AttendanceRecord[]> => {
    const result = await bulkUpsert.mutateAsync({
      body: {
        records: recordsForClassDate,
        ...(overrideReason ? { overrideReason } : {}),
      },
    });
    const body = (result?.body ?? result) as { records?: AttendanceRecord[] };
    return body.records ?? [];
  };

  /** Single-record update; echoes the OCC token when the caller has one. */
  const handleUpdateRecord = async (record: AttendanceRecord) => {
    await updateRecord.mutateAsync({
      params: { id: record.id },
      body: record,
      ...(typeof record.version === "number"
        ? { headers: { "x-expected-version": String(record.version) } }
        : {}),
    });
  };

  /** Locks the roster day (the server rejects later writes until an admin reopens it). */
  const submitRosterDay = async (classId: string, date: string) => {
    const result = await submitDay.mutateAsync({
      params: { classId, date },
      body: {},
    });
    return result.body;
  };

  /** Admin reopen of a submitted day; the reason is mandatory in the UI. */
  const reopenRosterDay = async (classId: string, date: string, reason?: string) => {
    const result = await reopenDay.mutateAsync({
      params: { classId, date },
      body: reason?.trim() ? { reason: reason.trim() } : {},
    });
    return result.body;
  };

  const handleDeleteRecord = async (id: string, reason?: string) => {
    try {
      await deleteRecord.mutateAsync({
        params: { id },
        // The API requires a justification for archiving attendance evidence.
        body: { deletionReason: reason?.trim() || t("attendance.trash.defaultReason") },
      });
      notify.success(t("attendance.toast.archived"));
    } catch (error) {
      notify.error(t("attendance.toast.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleRestoreRecord = async (id: string) => {
    try {
      await restoreRecord.mutateAsync({ params: { id }, body: {} });
      notify.success(t("attendance.toast.restored"));
    } catch (error) {
      notify.error(t("attendance.toast.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleBulkDeleteRecords = async (ids: string[], reason?: string) => {
    try {
      const result = await bulkDeleteRecords.mutateAsync({
        body: {
          ids,
          deletionReason: reason?.trim() || t("attendance.trash.defaultReason"),
        },
      });
      const body = (result.body ?? result) as { succeeded?: number };
      const succeeded = body.succeeded ?? ids.length;
      notify.success(
        t(succeeded > 1 ? "attendance.trash.bulkDeleted" : "attendance.toast.archived", {
          count: succeeded,
        }),
      );
    } catch (error) {
      notify.error(t("attendance.toast.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleBulkRestoreRecords = async (ids: string[]) => {
    try {
      const result = await bulkRestoreRecords.mutateAsync({ body: { ids } });
      const body = (result.body ?? result) as { succeeded?: number };
      const succeeded = body.succeeded ?? ids.length;
      notify.success(
        t(succeeded > 1 ? "attendance.trash.bulkRestored" : "attendance.toast.restored", {
          count: succeeded,
        }),
      );
    } catch (error) {
      notify.error(t("attendance.toast.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    messagingTarget,
    closeComposer,
    handleMessageAttendance,
    persistRecords,
    handleUpdateRecord,
    handleDeleteRecord,
    handleRestoreRecord,
    handleBulkDeleteRecords,
    handleBulkRestoreRecords,
    submitRosterDay,
    reopenRosterDay,
  };
}

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

  const persistRecords = async (recordsForClassDate: AttendanceRecord[]) => {
    await bulkUpsert.mutateAsync({ body: { records: recordsForClassDate } });
  };

  const handleUpdateRecord = async (record: AttendanceRecord) => {
    await updateRecord.mutateAsync({ params: { id: record.id }, body: record });
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await deleteRecord.mutateAsync({ params: { id } });
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

  const handleBulkDeleteRecords = async (ids: string[]) => {
    try {
      const result = await bulkDeleteRecords.mutateAsync({ body: { ids } });
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
  };
}

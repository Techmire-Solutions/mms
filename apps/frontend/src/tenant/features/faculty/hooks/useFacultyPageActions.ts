import { useTranslation } from "@/hooks/useTranslation";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { notify } from "@/lib/notify";
import type { Faculty } from "@mms/shared";
import { useFacultyMutations } from "@/tenant/features/faculty/hooks/useFaculty";
import { useFacultyCrudNotify } from "@/tenant/features/faculty/hooks/useFacultyCrudNotify";
import { type FacultyRecord, toMessagingRecipient } from "@mms/shared";

export interface UseFacultyPageActionsParams {
  editFaculty?: Faculty | null;
}

export function useFacultyPageActions({ editFaculty }: UseFacultyPageActionsParams) {
  const effectiveEditTarget = editFaculty ?? null;
  const { t } = useTranslation();
  const { handleError, notifyBulkResult, notifyArchivedWithUndo } = useFacultyCrudNotify();
  const {
    createFaculty,
    updateFaculty,
    deleteFaculty,
    bulkDeleteFaculty,
    restoreFaculty,
    bulkRestoreFaculty,
    bulkUpdateFacultyStatus,
    bulkUpdateFacultySpecialization,
    isBulkSpecializationPending,
  } = useFacultyMutations();
  const { messagingTarget, openComposer, closeComposer, canWriteMessaging } =
    useMessageComposerState();

  const toRecipients = (list: Faculty[]) => list.map((item) => toMessagingRecipient(item));

  const handleWhatsApp = (list: Faculty[]) => {
    if (!canWriteMessaging) return;
    openComposer("whatsapp", toRecipients(list));
  };

  const handleSms = (list: Faculty[]) => {
    if (!canWriteMessaging) return;
    openComposer("sms", toRecipients(list));
  };

  const handleEmail = (list: Faculty[]) => {
    if (!canWriteMessaging) return;
    openComposer("email", toRecipients(list));
  };

  const handleSaveFaculty = async (facultyToSave: Faculty): Promise<Faculty> => {
    if (effectiveEditTarget) {
      const res = await updateFaculty.mutateAsync({
        params: { id: String(facultyToSave.id) },
        body: facultyToSave as FacultyRecord,
      });
      notify.success(t("faculty.toast.updated"));
      const raw = res.body as unknown;
      if (raw && typeof raw === "object") {
        const envelope = raw as Record<string, unknown>;
        const entity = envelope.faculty ?? envelope.facultyMember ?? envelope;
        return entity as Faculty;
      }
      return raw as Faculty;
    } else {
      const res = await createFaculty.mutateAsync({
        body: facultyToSave as FacultyRecord,
      });
      notify.success(t("faculty.toast.created"));
      const raw = res.body as unknown;
      if (raw && typeof raw === "object") {
        const envelope = raw as Record<string, unknown>;
        const entity = envelope.faculty ?? envelope.facultyMember ?? envelope;
        return entity as Faculty;
      }
      return raw as Faculty;
    }
  };

  const handleDelete = async (id: string, deletionReason?: string): Promise<void> => {
    try {
      await deleteFaculty.mutateAsync({ params: { id }, body: { deletionReason } });
      notifyArchivedWithUndo(() => handleRestore(id));
    } catch (error) {
      handleError(error, "faculty.delete", "faculty.deleteFailed");
      throw error;
    }
  };

  const handleRestore = async (id: string): Promise<void> => {
    try {
      await restoreFaculty.mutateAsync({ params: { id }, body: {} });
      notifyBulkResult(1, 0, "faculty.restoreSuccess", "faculty.restoreSuccess");
    } catch (error) {
      handleError(error, "faculty.restore", "faculty.restoreFailed");
      throw error;
    }
  };

  const handleBulkDelete = async (ids: string[], deletionReason?: string): Promise<void> => {
    try {
      const result = await bulkDeleteFaculty.mutateAsync({ body: { ids, deletionReason } });
      notifyBulkResult(
        result.body.succeeded,
        result.body.failed,
        "faculty.toast.deleted",
        "faculty.toast.deleted",
      );
    } catch (error) {
      handleError(error, "faculty.bulk_delete", "faculty.deleteFailed");
      throw error;
    }
  };

  const handleBulkRestore = async (ids: string[]): Promise<void> => {
    try {
      const result = await bulkRestoreFaculty.mutateAsync({ body: { ids } });
      notifyBulkResult(
        result.body.succeeded,
        result.body.failed,
        "faculty.restoreSuccess",
        "faculty.restoreSuccess",
      );
    } catch (error) {
      handleError(error, "faculty.bulk_restore", "faculty.restoreFailed");
      throw error;
    }
  };

  const handleBulkStatusChange = async (ids: string[], status: string): Promise<void> => {
    try {
      const result = await bulkUpdateFacultyStatus.mutateAsync({ body: { ids, status } });
      notifyBulkResult(
        result.body.succeeded,
        result.body.failed,
        "faculty.toast.statusUpdated",
        "faculty.toast.statusUpdated",
      );
    } catch (error) {
      handleError(error, "faculty.bulk_status", "faculty.bulkStatusFailed");
      throw error;
    }
  };

  const handleBulkSpecializationChange = async (
    ids: string[],
    specialization: string,
  ): Promise<void> => {
    try {
      const result = await bulkUpdateFacultySpecialization({ body: { ids, specialization } });
      notifyBulkResult(
        result.body.succeeded,
        result.body.failed,
        "faculty.bulkSpecializationSuccess",
        "faculty.bulkSpecializationSuccess",
      );
    } catch (error) {
      handleError(error, "faculty.bulk_specialization", "faculty.bulkStatusFailed");
      throw error;
    }
  };

  return {
    messagingTarget,
    openComposer,
    canWriteMessaging,
    closeComposer,
    handleWhatsApp,
    handleSms,
    handleEmail,
    handleSaveFaculty,
    handleDelete,
    handleRestore,
    handleBulkDelete,
    handleBulkRestore,
    handleBulkStatusChange,
    handleBulkSpecializationChange,
    isBulkSpecializationPending,
  };
}

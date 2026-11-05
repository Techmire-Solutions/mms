import { useTranslation } from "@/hooks/useTranslation";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { notify } from "@/lib/notify";
import { assertContractOk } from "@/lib/apiContractError";
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
      const expectedUpdatedAt =
        typeof effectiveEditTarget.updatedAt === "string"
          ? effectiveEditTarget.updatedAt
          : undefined;
      const res = await updateFaculty.mutateAsync({
        params: { id: String(facultyToSave.id) },
        body: facultyToSave as FacultyRecord,
        // Optimistic concurrency: surface a 409 instead of silently overwriting.
        ...(expectedUpdatedAt
          ? { extraHeaders: { "x-expected-updated-at": expectedUpdatedAt } }
          : {}),
      });
      // The ts-rest fetcher resolves 4xx/5xx: without this guard a 409 OCC
      // conflict would be announced as a successful update.
      assertContractOk(res, t("faculty.toast.saveFailed"));
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
      assertContractOk(res, t("faculty.toast.saveFailed"));
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
      const res = await deleteFaculty.mutateAsync({ params: { id }, body: { deletionReason } });
      assertContractOk(res, t("faculty.deleteFailed"));
      notifyArchivedWithUndo(() => handleRestore(id));
    } catch (error) {
      handleError(error, "faculty.delete", "faculty.deleteFailed");
      throw error;
    }
  };

  const handleRestore = async (id: string): Promise<void> => {
    try {
      const res = await restoreFaculty.mutateAsync({ params: { id }, body: {} });
      assertContractOk(res, t("faculty.restoreFailed"));
      notifyBulkResult(1, 0, "faculty.restoreSuccess", "faculty.restoreSuccess");
    } catch (error) {
      handleError(error, "faculty.restore", "faculty.restoreFailed");
      throw error;
    }
  };

  const handleBulkDelete = async (ids: string[], deletionReason?: string): Promise<void> => {
    try {
      const result = await bulkDeleteFaculty.mutateAsync({ body: { ids, deletionReason } });
      assertContractOk(result, t("faculty.deleteFailed"));
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
      assertContractOk(result, t("faculty.restoreFailed"));
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
      assertContractOk(result, t("faculty.bulkStatusFailed"));
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
      assertContractOk(result, t("faculty.bulkStatusFailed"));
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

import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import type { Enrollment, EnrollmentInsert } from "@mms/shared";
import { useEnrollmentViewerRole } from "@/tenant/hooks/useViewerRole";
import { useEnrollmentMutations } from "@/tenant/features/enrollments/hooks/useEnrollmentsApi";
import { useEnrollmentsBulkActions } from "@/tenant/features/enrollments/hooks/useEnrollmentsBulkActions";
import { useEnrollmentOperations } from "@/tenant/features/enrollments/hooks/useEnrollmentOperations";

export interface UseEnrollmentsPageActionsParams {
  enrollments: Enrollment[];
  viewing: Enrollment | null;
  /** Administrative capability (drops/transfers/completions); the server enforces it too. */
  canManage?: boolean;
  onViewingChange: (enrollment: Enrollment | null) => void;
  onActiveSubTabChange: (subTab: string) => void;
}

export function useEnrollmentsPageActions({
  enrollments,
  viewing,
  canManage = false,
  onViewingChange,
  onActiveSubTabChange,
}: UseEnrollmentsPageActionsParams) {
  const { t } = useTranslation();
  const role = useEnrollmentViewerRole();
  const {
    createEnrollment,
    updateEnrollment,
    deleteEnrollment,
    restoreEnrollment,
    bulkDeleteEnrollments,
    bulkRestoreEnrollments,
  } = useEnrollmentMutations();
  const { withdraw, bulkEnd } = useEnrollmentOperations();

  const handleComplete = async (enrollment: EnrollmentInsert) => {
    try {
      // The server keeps the student's session membership in sync with enrollments.
      await createEnrollment.mutateAsync(enrollment);
      notify.success(t("enrollments.toast.created"));
      onActiveSubTabChange("directory");
    } catch (error) {
      notify.error(t("enrollments.toast.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  /**
   * Cancelling is an *operation*, not a status edit: the shared end path closes the
   * placement, ends the window and settles later invoices. The previous implementation
   * only rewrote `status` through PUT and silently skipped all of that.
   */
  const handleCancel = async (id: string) => {
    const enrollment = enrollments.find((candidate) => candidate.id === id);
    if (!enrollment) return;
    const ok = await withdraw(id, {
      reason: t("enrollments.timeline.cancelled"),
      endAs: "cancelled",
    });
    if (ok && viewing?.id === id) onViewingChange(null);
  };

  const handleDelete = (id: string, deletionReason?: string) => {
    deleteEnrollment.mutate(
      { id, deletionReason },
      {
        onSuccess: () => {
          notify.archivedWithUndo(
            t("enrollments.toast.deleted"),
            () => {
              restoreEnrollment.mutate(id, {
                onSuccess: () => notify.success(t("enrollments.toast.restored")),
                onError: (err: unknown) =>
                  notify.error(t("enrollments.toast.saveFailed"), {
                    description: err instanceof Error ? err.message : String(err),
                  }),
              });
            },
            { undoLabel: t("common.undo"), duration: 8000 },
          );
          if (viewing?.id === id) onViewingChange(null);
        },
        onError: (err: unknown) =>
          notify.error(t("enrollments.toast.saveFailed"), {
            description: err instanceof Error ? err.message : String(err),
          }),
      },
    );
  };

  const handleRestore = (id: string) => {
    restoreEnrollment.mutate(id, {
      onSuccess: () => notify.success(t("enrollments.toast.restored")),
      onError: (err: unknown) =>
        notify.error(t("enrollments.toast.saveFailed"), {
          description: err instanceof Error ? err.message : String(err),
        }),
    });
  };

  const { handleBulkDelete, handleBulkRestore, handleBulkCancel } = useEnrollmentsBulkActions({
    bulkDeleteEnrollments,
    bulkRestoreEnrollments,
    onBulkCancel: (ids) => {
      if (!canManage) {
        notify.error(t("errors.route.forbiddenTitle"), {
          description: t("errors.route.forbidden"),
        });
        return;
      }
      void bulkEnd(ids, {
        reason: t("enrollments.timeline.cancelled"),
        endAs: "cancelled",
      });
    },
  });

  const updateEnrollmentWithTimeline = (
    enrollment: Enrollment,
    event: string,
    patch: Partial<Enrollment>,
  ) => {
    const updated: Enrollment = {
      ...enrollment,
      ...patch,
      timeline: [...(enrollment.timeline || []), { ts: new Date().toISOString(), event, by: role }],
    };
    // Send only what changed plus the new timeline event (the server appends entries without
    // an id). Sending the full row would carry the list projection's empty `notes` back.
    updateEnrollment.mutate(
      {
        id: enrollment.id,
        enrollment: {
          ...patch,
          timeline: [{ ts: new Date().toISOString(), event, by: role }],
        },
      },
      {
        onSuccess: () => {
          if (viewing?.id === enrollment.id) onViewingChange(updated);
          notify.success(t("enrollments.toast.updated"));
        },
        onError: (err: unknown) =>
          notify.error(t("enrollments.toast.saveFailed"), {
            description: err instanceof Error ? err.message : String(err),
          }),
      },
    );
  };

  const handleStatusChange = (id: string, newStatus: Enrollment["status"]) => {
    const enrollment = enrollments.find((candidate) => candidate.id === id);
    if (!enrollment) return;
    // Terminal outcomes go through their operation (side effects included). Only the
    // manual edge (pending → confirmed) is a plain update.
    if (newStatus === "cancelled" || newStatus === "withdrawn") {
      void handleCancel(id);
      return;
    }
    updateEnrollmentWithTimeline(
      enrollment,
      t("enrollments.timeline.statusChange", { status: newStatus }),
      { status: newStatus },
    );
  };

  const handlePaymentStatusChange = (id: string, newPaymentStatus: Enrollment["paymentStatus"]) => {
    const enrollment = enrollments.find((candidate) => candidate.id === id);
    if (!enrollment) return;
    updateEnrollmentWithTimeline(
      enrollment,
      t("enrollments.timeline.paymentStatusChange", { status: newPaymentStatus }),
      { paymentStatus: newPaymentStatus },
    );
  };

  return {
    handleComplete,
    handleCancel,
    handleDelete,
    handleRestore,
    handleStatusChange,
    handlePaymentStatusChange,
    handleBulkDelete,
    handleBulkRestore,
    handleBulkCancel,
  };
}

import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import type { Enrollment } from "@/lib/data/enrollmentData";
import { useEnrollmentViewerRole } from "@/tenant/hooks/useViewerRole";
import {
  useEnrollmentMutations,
} from "@/tenant/features/enrollments/hooks/useEnrollmentsApi";
import { useEnrollmentsBulkActions } from "@/tenant/features/enrollments/hooks/useEnrollmentsBulkActions";

export interface UseEnrollmentsPageActionsParams {
  enrollments: Enrollment[];
  viewing: Enrollment | null;
  onViewingChange: (enrollment: Enrollment | null) => void;
  onActiveSubTabChange: (subTab: string) => void;
}

export function useEnrollmentsPageActions({
  enrollments,
  viewing,
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

  const handleComplete = async (enrollment: Enrollment) => {
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

  const handleCancel = (id: string) => {
    const enrollment = enrollments.find((candidate) => candidate.id === id);
    if (!enrollment) return;
    updateEnrollment.mutate({
      id,
      enrollment: {
        ...enrollment,
        status: "cancelled" as const,
        timeline: [
          ...(enrollment.timeline || []),
          { ts: new Date().toISOString(), event: t("enrollments.timeline.cancelled"), by: role },
        ],
      },
    }, {
      onSuccess: () => notify.info(t("enrollments.toast.cancelled")),
      onError: (err: unknown) => notify.error(t("enrollments.toast.saveFailed"), {
        description: err instanceof Error ? err.message : String(err),
      }),
    });
  };

  const handleDelete = (id: string, deletionReason?: string) => {
    deleteEnrollment.mutate({ id, deletionReason }, {
      onSuccess: () => {
        notify.archivedWithUndo(
          t("enrollments.toast.deleted"),
          () => {
            restoreEnrollment.mutate(id, {
              onSuccess: () => notify.success(t("enrollments.toast.restored")),
              onError: (err: unknown) => notify.error(t("enrollments.toast.saveFailed"), {
                description: err instanceof Error ? err.message : String(err),
              }),
            });
          },
          { undoLabel: t("common.undo"), duration: 8000 },
        );
        if (viewing?.id === id) onViewingChange(null);
      },
      onError: (err: unknown) => notify.error(t("enrollments.toast.saveFailed"), {
        description: err instanceof Error ? err.message : String(err),
      }),
    });
  };

  const handleRestore = (id: string) => {
    restoreEnrollment.mutate(id, {
      onSuccess: () => notify.success(t("enrollments.toast.restored")),
      onError: (err: unknown) => notify.error(t("enrollments.toast.saveFailed"), {
        description: err instanceof Error ? err.message : String(err),
      }),
    });
  };

  const { handleBulkDelete, handleBulkRestore, handleBulkCancel } = useEnrollmentsBulkActions({
    bulkDeleteEnrollments,
    bulkRestoreEnrollments,
    handleCancel,
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
    updateEnrollment.mutate(
      { id: enrollment.id, enrollment: updated },
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
    updateEnrollmentWithTimeline(
      enrollment,
      t("enrollments.timeline.statusChange", { status: newStatus }),
      { status: newStatus },
    );
  };

  const handlePaymentStatusChange = (
    id: string,
    newPaymentStatus: Enrollment["paymentStatus"],
  ) => {
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

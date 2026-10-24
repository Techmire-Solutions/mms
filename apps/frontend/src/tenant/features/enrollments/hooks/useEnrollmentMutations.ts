import { useQueryClient } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import type { Enrollment } from "@mms/shared";
import { tsrClient } from "@/lib/api";
import { invalidateEnrollmentsQueries } from "./invalidateEnrollmentsQueries";

export function useEnrollmentMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateEnrollmentsQueries(queryClient);

  const createEnrollment = tsrClient.enrollments.create.useMutation({ onSuccess: invalidate });
  const updateEnrollment = tsrClient.enrollments.update.useMutation({ onSuccess: invalidate });
  const deleteEnrollment = tsrClient.enrollments.delete.useMutation({ onSuccess: invalidate });
  const restoreEnrollment = tsrClient.enrollments.restore.useMutation({ onSuccess: invalidate });
  const bulkDeleteEnrollments = tsrClient.enrollments.bulkDelete.useMutation({
    onSuccess: invalidate,
  });
  const bulkRestoreEnrollments = tsrClient.enrollments.bulkRestore.useMutation({
    onSuccess: invalidate,
  });
  const logExportAudit = tsrClient.enrollments.exportAudit.useMutation({});

  return {
    createEnrollment: {
      ...createEnrollment,
      mutate: (enrollment: Enrollment, opts?: MutateOptions) =>
        createEnrollment.mutate({ body: enrollment }, opts),
      mutateAsync: (enrollment: Enrollment) => createEnrollment.mutateAsync({ body: enrollment }),
    },
    updateEnrollment: {
      ...updateEnrollment,
      mutate: ({ id, enrollment }: { id: string; enrollment: Enrollment }, opts?: MutateOptions) =>
        updateEnrollment.mutate({ params: { id }, body: enrollment }, opts),
      mutateAsync: ({ id, enrollment }: { id: string; enrollment: Enrollment }) =>
        updateEnrollment.mutateAsync({ params: { id }, body: enrollment }),
    },
    deleteEnrollment: {
      ...deleteEnrollment,
      mutate: (
        { id, deletionReason }: { id: string; deletionReason?: string },
        opts?: MutateOptions,
      ) =>
        deleteEnrollment.mutate(
          { params: { id }, body: deletionReason ? { deletionReason } : {} },
          opts,
        ),
      mutateAsync: ({ id, deletionReason }: { id: string; deletionReason?: string }) =>
        deleteEnrollment.mutateAsync({
          params: { id },
          body: deletionReason ? { deletionReason } : {},
        }),
    },
    restoreEnrollment: {
      ...restoreEnrollment,
      mutate: (id: string, opts?: MutateOptions) =>
        restoreEnrollment.mutate({ params: { id }, body: {} }, opts),
      mutateAsync: (id: string) => restoreEnrollment.mutateAsync({ params: { id }, body: {} }),
    },
    bulkDeleteEnrollments: {
      ...bulkDeleteEnrollments,
      mutate: (
        { ids, deletionReason }: { ids: string[]; deletionReason?: string },
        opts?: MutateOptions,
      ) =>
        bulkDeleteEnrollments.mutate(
          { body: { ids, ...(deletionReason ? { deletionReason } : {}) } },
          opts,
        ),
      mutateAsync: ({ ids, deletionReason }: { ids: string[]; deletionReason?: string }) =>
        bulkDeleteEnrollments.mutateAsync({
          body: { ids, ...(deletionReason ? { deletionReason } : {}) },
        }),
    },
    bulkRestoreEnrollments: {
      ...bulkRestoreEnrollments,
      mutate: (ids: string[], opts?: MutateOptions) =>
        bulkRestoreEnrollments.mutate({ body: { ids } }, opts),
      mutateAsync: (ids: string[]) => bulkRestoreEnrollments.mutateAsync({ body: { ids } }),
    },
    logExportAudit: {
      ...logExportAudit,
      mutate: (
        payload: { count: number; scope: "all" | "filtered" | "selection" },
        opts?: MutateOptions,
      ) => logExportAudit.mutate({ body: payload }, opts),
      mutateAsync: (payload: { count: number; scope: "all" | "filtered" | "selection" }) =>
        logExportAudit.mutateAsync({ body: payload }),
    },
  };
}

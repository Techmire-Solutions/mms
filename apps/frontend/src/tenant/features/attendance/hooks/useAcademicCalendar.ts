import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AcademicCalendarEvent, AcademicCalendarEventWrite } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { isApiError } from "@/lib/apiError";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import {
  academicCalendarQueryOptions,
  deleteAcademicCalendarEventMutationOptions,
  invalidateAcademicCalendarQueries,
  restoreAcademicCalendarEventMutationOptions,
  saveAcademicCalendarEventMutationOptions,
  type AcademicCalendarRangeQuery,
} from "@/lib/query/academicCalendarQueries";
import { invalidateAttendanceQueries } from "./invalidateAttendanceQueries";

/** Calendar events overlapping a date range. */
export function useAcademicCalendarEvents(range: AcademicCalendarRangeQuery, enabled = true) {
  const { isAuthenticated } = useAuth();
  return useQuery(academicCalendarQueryOptions(range, isAuthenticated && enabled));
}

function errorDetail(error: unknown): string | undefined {
  return isApiError(error) && (error.status === 400 || error.status === 409)
    ? error.message
    : undefined;
}

/** Save / delete / restore with call-site toasts; each resolves to null/false on failure. */
export function useAcademicCalendarActions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const onSettled = () => {
    invalidateAcademicCalendarQueries(queryClient);
    // Holidays change which marked days count toward attendance rates.
    invalidateAttendanceQueries(queryClient);
  };
  const saveMutation = useMutation({ ...saveAcademicCalendarEventMutationOptions(), onSettled });
  const deleteMutation = useMutation({
    ...deleteAcademicCalendarEventMutationOptions(),
    onSettled,
  });
  const restoreMutation = useMutation({
    ...restoreAcademicCalendarEventMutationOptions(),
    onSettled,
  });

  const save = async (
    id: string | undefined,
    body: AcademicCalendarEventWrite,
  ): Promise<AcademicCalendarEvent | null> => {
    try {
      const saved = await saveMutation.mutateAsync({ id: id ?? crypto.randomUUID(), body });
      notify.success(t("attendance.calendar.saved"));
      return saved;
    } catch (error) {
      notify.error(t("attendance.calendar.saveFailed"), { description: errorDetail(error) });
      return null;
    }
  };

  const remove = async (target: AcademicCalendarEvent): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(target.id);
      notify.info(t("attendance.calendar.deleted"));
      return true;
    } catch (error) {
      notify.error(t("attendance.calendar.deleteFailed"), { description: errorDetail(error) });
      return false;
    }
  };

  const restore = async (target: AcademicCalendarEvent): Promise<boolean> => {
    try {
      await restoreMutation.mutateAsync(target.id);
      notify.success(t("attendance.calendar.restored"));
      return true;
    } catch (error) {
      notify.error(t("attendance.calendar.restoreFailed"), { description: errorDetail(error) });
      return false;
    }
  };

  return {
    save,
    remove,
    restore,
    isPending: saveMutation.isPending || deleteMutation.isPending || restoreMutation.isPending,
  };
}

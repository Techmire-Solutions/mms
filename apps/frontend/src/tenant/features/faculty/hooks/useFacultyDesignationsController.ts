import { useCallback } from "react";
import type { FacultyDesignationDefinition, FacultyDesignationWrite } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  useDeleteFacultyDesignation,
  useFacultyDesignations,
  useSaveFacultyDesignation,
} from "./useFacultyDesignations";

/** Payload the designation form produces (Faculty Management model). */
export type FacultyDesignationFormPayload = Omit<FacultyDesignationWrite, "id"> & { id?: string };

const messageOf = (err: unknown): string => (err instanceof Error ? err.message.toLowerCase() : "");

/**
 * Single owner of designation catalog writes: server save/delete plus user
 * notifications. Used by the Setup tab and the in-form quick-create overlay.
 */
export function useFacultyDesignationsController() {
  const { t } = useTranslation();
  const query = useFacultyDesignations();
  const saveMutation = useSaveFacultyDesignation();
  const deleteMutation = useDeleteFacultyDesignation();
  const designations = query.data ?? [];

  const saveDesignation = useCallback(
    async (
      payload: FacultyDesignationFormPayload,
    ): Promise<FacultyDesignationDefinition | null> => {
      try {
        const saved = await saveMutation.mutateAsync({
          id: payload.id || crypto.randomUUID(),
          departmentId: payload.departmentId,
          name: payload.name.trim(),
          parentDesignationId: payload.parentDesignationId || null,
          status: payload.status ?? "active",
          assignableRoles: payload.assignableRoles ?? [],
        });
        notify.success(t("faculty.designations.saved"));
        return saved;
      } catch (err) {
        const msg = messageOf(err);
        if (msg.includes("circular")) notify.error(t("faculty.designations.parentCycle"));
        else if (msg.includes("already exists"))
          notify.error(t("faculty.designations.nameDuplicate"));
        else notify.error(t("faculty.setup.lookupsSaveFailed"));
        return null;
      }
    },
    [saveMutation, t],
  );

  const handleDelete = useCallback(
    async (designation: FacultyDesignationDefinition): Promise<boolean> => {
      try {
        await deleteMutation.mutateAsync(designation.id);
        notify.success(t("faculty.designations.deleted"));
        return true;
      } catch (err) {
        notify.error(
          messageOf(err).includes("dependent")
            ? t("faculty.designations.inUse")
            : t("faculty.designations.deleteFailed"),
        );
        return false;
      }
    },
    [deleteMutation, t],
  );

  return {
    t,
    query,
    designations,
    isLoading: query.isLoading,
    isPending: saveMutation.isPending || deleteMutation.isPending,
    isSaving: saveMutation.isPending,
    saveDesignation,
    handleDelete,
  };
}

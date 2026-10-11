import { useCallback, useMemo } from "react";
import {
  isDuplicateFacultyDepartmentName,
  type FacultyDepartmentEntity,
  type FacultyDepartmentWrite,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  useFacultyDepartments,
  useSaveFacultyDepartment,
  useDeleteFacultyDepartment,
} from "./useFacultyDepartments";

/** Payload the department form produces (Faculty Management model: name / description / status). */
export type FacultyDepartmentFormPayload = Omit<FacultyDepartmentWrite, "id"> & { id?: string };

const isDeleteConflict = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return msg.includes("designation") || msg.includes("assignment") || msg.includes("dependents");
};

const isNameConflict = (err: unknown): boolean =>
  err instanceof Error && err.message.toLowerCase().includes("already exists");

/**
 * Single owner of department catalog writes: duplicate-name preflight, server
 * save/delete, and user notifications. Both the Setup tab and the in-form
 * quick-create overlay go through this hook.
 */
export function useFacultyDepartmentsController() {
  const { t } = useTranslation();
  const { data: departments = [], isLoading } = useFacultyDepartments();
  const saveMutation = useSaveFacultyDepartment();
  const deleteMutation = useDeleteFacultyDepartment();

  const isPending = saveMutation.isPending || deleteMutation.isPending || isLoading;

  const orderedDepartments = useMemo(
    () =>
      [...departments].sort((a, b) => {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [departments],
  );

  const saveDepartment = useCallback(
    async (payload: FacultyDepartmentFormPayload): Promise<FacultyDepartmentEntity | null> => {
      const name = payload.name.trim();
      if (!name) return null;
      if (isDuplicateFacultyDepartmentName(departments, name, payload.id ?? null)) {
        notify.error(t("faculty.setup.departmentNameDuplicate"));
        return null;
      }
      try {
        const saved = await saveMutation.mutateAsync({
          id: payload.id || crypto.randomUUID(),
          name,
          description: payload.description?.trim() ? payload.description.trim() : null,
          status: payload.status ?? "active",
        });
        notify.success(t("faculty.setup.departmentSaved"));
        return saved;
      } catch (err) {
        notify.error(
          isNameConflict(err)
            ? t("faculty.setup.departmentNameDuplicate")
            : t("faculty.setup.lookupsSaveFailed"),
        );
        return null;
      }
    },
    [departments, saveMutation, t],
  );

  const handleDelete = useCallback(
    async (dept: FacultyDepartmentEntity): Promise<boolean> => {
      try {
        await deleteMutation.mutateAsync(dept.id);
        notify.success(t("faculty.setup.departmentSaved"));
        return true;
      } catch (err) {
        notify.error(
          isDeleteConflict(err)
            ? t("faculty.setup.departmentInUse")
            : t("faculty.setup.lookupsSaveFailed"),
        );
        return false;
      }
    },
    [deleteMutation, t],
  );

  return {
    t,
    departments,
    orderedDepartments,
    isLoading,
    isPending,
    isSaving: saveMutation.isPending,
    saveDepartment,
    handleDelete,
  };
}

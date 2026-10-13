import React, { useState } from "react";
import type { FacultyDepartmentEntity } from "@mms/shared";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ErrorState } from "@/components/app/ErrorState";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { FacultyDepartmentsTable } from "./FacultyDepartmentsTable";
import { FacultyDepartmentFormModal } from "./FacultyDepartmentFormModal";
import { useFacultyDepartmentsController } from "../hooks/useFacultyDepartmentsController";
import { useFacultyDepartments } from "../hooks/useFacultyDepartments";

/** Departments work surface — same directory chrome as Faculties (toolbar + table/cards). */
export function FacultyDepartmentsSetupSection({
  canWrite = true,
}: {
  canWrite?: boolean;
}): React.JSX.Element {
  const { t, departments, orderedDepartments, isPending, isSaving, saveDepartment, handleDelete } =
    useFacultyDepartmentsController();
  const query = useFacultyDepartments();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<FacultyDepartmentEntity | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<FacultyDepartmentEntity | null>(null);

  const handleStartEdit = (dept: FacultyDepartmentEntity) => {
    if (!canWrite) return;
    setEditingDepartment(dept);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingDepartment(null);
  };

  const handleConfirmDelete = async () => {
    if (!deptToDelete) return;
    const deleted = await handleDelete(deptToDelete);
    if (deleted && editingDepartment?.id === deptToDelete.id) handleCloseModal();
    setDeptToDelete(null);
  };

  return (
    <ErrorBoundary>
      <ModuleTierMotion tier="work-departments" className="space-y-5">
        {query.isError ? (
          <ErrorState
            title={t("faculty.setup.departmentsLoadFailed")}
            description={t("faculty.loadFailedHint")}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <FacultyDepartmentsTable
            departments={orderedDepartments}
            editingDepartmentId={editingDepartment?.id}
            isPending={isPending}
            isLoading={query.isLoading}
            canWrite={canWrite}
            onEdit={handleStartEdit}
            onDelete={(d) => {
              if (!canWrite) return;
              setDeptToDelete(d);
            }}
          />
        )}

        {canWrite ? (
          <FacultyDepartmentFormModal
            open={modalOpen}
            onClose={handleCloseModal}
            department={editingDepartment}
            existingDepartments={departments}
            isPending={isSaving}
            onSave={async (payload) => (await saveDepartment(payload)) !== null}
          />
        ) : null}

        <ConfirmAlertDialog
          open={Boolean(deptToDelete)}
          onOpenChange={(open) => !open && setDeptToDelete(null)}
          title={t("faculty.setup.deleteDepartment")}
          description={
            deptToDelete
              ? t("faculty.setup.deleteDepartmentConfirm", { name: deptToDelete.name })
              : ""
          }
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.cancel")}
          destructive
          onConfirm={handleConfirmDelete}
        />
      </ModuleTierMotion>
    </ErrorBoundary>
  );
}

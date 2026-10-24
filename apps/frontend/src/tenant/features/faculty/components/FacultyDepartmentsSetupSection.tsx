import React, { useState } from "react";
import type { FacultyDepartmentEntity } from "@mms/shared";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ErrorState } from "@/components/app/ErrorState";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { ModuleTrashToggle } from "@/components/app/ModuleTrashToggle";
import { FacultyDepartmentsTable } from "./FacultyDepartmentsTable";
import { FacultyDepartmentFormModal } from "./FacultyDepartmentFormModal";
import { useFacultyDepartmentsController } from "../hooks/useFacultyDepartmentsController";

/** Departments work surface — includes trash recovery toggle and restore actions. */
export function FacultyDepartmentsSetupSection({
  canWrite = true,
}: {
  canWrite?: boolean;
}): React.JSX.Element {
  const {
    t,
    departments,
    orderedDepartments,
    isLoading,
    isError,
    isPending,
    isSaving,
    showDeleted,
    setShowDeleted,
    saveDepartment,
    handleDelete,
    handleRestore,
    refetch,
  } = useFacultyDepartmentsController();

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

  const primaryAction = canWrite ? (
    <ModuleTrashToggle
      viewingDeleted={showDeleted}
      onToggle={() => setShowDeleted((prev) => !prev)}
      activeLabel={t("faculty.showActive")}
      deletedLabel={t("faculty.showDeleted")}
    />
  ) : null;

  return (
    <ErrorBoundary>
      <ModuleTierMotion tier="work-departments" className="space-y-5">
        {isError ? (
          <ErrorState
            title={t("faculty.setup.departmentsLoadFailed")}
            description={t("faculty.loadFailedHint")}
            onRetry={() => void refetch()}
          />
        ) : (
          <FacultyDepartmentsTable
            departments={orderedDepartments}
            editingDepartmentId={editingDepartment?.id}
            isPending={isPending}
            isLoading={isLoading}
            canWrite={canWrite}
            primaryAction={primaryAction}
            onEdit={handleStartEdit}
            onDelete={(d) => {
              if (!canWrite) return;
              setDeptToDelete(d);
            }}
            onRestore={handleRestore}
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

import React, { useState } from "react";
import type { FacultyDesignationDefinition } from "@mms/shared";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ErrorState } from "@/components/app/ErrorState";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { useFacultyDepartments } from "../hooks/useFacultyDepartments";
import { useFacultyDesignationsController } from "../hooks/useFacultyDesignationsController";
import { FacultyDesignationsTable } from "./FacultyDesignationsTable";
import { FacultyDesignationFormModal } from "./FacultyDesignationFormModal";

/** Designations work surface — same directory chrome as Faculties (toolbar + table/cards). */
export function FacultyDesignationsSetupSection({
  canWrite = true,
}: {
  canWrite?: boolean;
}): React.JSX.Element {
  const { t, query, designations, isPending, isSaving, saveDesignation, handleDelete } =
    useFacultyDesignationsController();
  const { data: departments = [] } = useFacultyDepartments();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState<FacultyDesignationDefinition | null>(
    null,
  );
  const [designationToDelete, setDesignationToDelete] =
    useState<FacultyDesignationDefinition | null>(null);

  const handleStartEdit = (designation: FacultyDesignationDefinition) => {
    if (!canWrite) return;
    setEditingDesignation(designation);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingDesignation(null);
  };

  const handleConfirmDelete = async () => {
    if (!designationToDelete) return;
    const deleted = await handleDelete(designationToDelete);
    if (deleted && editingDesignation?.id === designationToDelete.id) handleCloseModal();
    setDesignationToDelete(null);
  };

  return (
    <ErrorBoundary>
      <ModuleTierMotion tier="work-designations" className="space-y-5">
        {query.isError ? (
          <ErrorState
            title={t("faculty.designations.loadFailed")}
            description={t("faculty.loadFailedHint")}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <FacultyDesignationsTable
            designations={designations}
            editingDesignationId={editingDesignation?.id}
            isPending={isPending}
            isLoading={query.isLoading}
            canWrite={canWrite}
            onEdit={handleStartEdit}
            onDelete={(d) => {
              if (!canWrite) return;
              setDesignationToDelete(d);
            }}
          />
        )}

        {canWrite ? (
          <FacultyDesignationFormModal
            open={modalOpen}
            onClose={handleCloseModal}
            designation={editingDesignation}
            departments={departments}
            designationOptions={designations}
            isPending={isSaving}
            onSave={async (payload) => (await saveDesignation(payload)) !== null}
          />
        ) : null}

        <ConfirmAlertDialog
          open={Boolean(designationToDelete)}
          onOpenChange={(open) => !open && setDesignationToDelete(null)}
          title={t("faculty.designations.deleteDesignation")}
          description={
            designationToDelete
              ? t("faculty.designations.deleteDesignationConfirm", {
                  name: designationToDelete.name,
                })
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

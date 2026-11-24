import React, { useState } from "react";
import type { FacultyDepartmentEntity, FacultyDesignationDefinition } from "@mms/contracts";
import { FacultyDepartmentFormModal } from "@/tenant/features/faculty/components/FacultyDepartmentFormModal";
import { FacultyDesignationFormModal } from "@/tenant/features/faculty/components/FacultyDesignationFormModal";
import { useFacultyDepartmentsController } from "@/tenant/features/faculty/hooks/useFacultyDepartmentsController";
import { useFacultyDesignationsController } from "@/tenant/features/faculty/hooks/useFacultyDesignationsController";

export interface FacultyCatalogCreateOverlaysProps {
  createDepartmentOpen: boolean;
  onCloseDepartment: () => void;
  createDesignationOpen: boolean;
  onCloseDesignation: () => void;
  /** Pre-selects the department when the designation modal opens from a department-scoped context. */
  designationDefaultDepartmentId?: string;
  /** Called with the saved entity after a successful create (before close). */
  onDepartmentCreated?: (department: FacultyDepartmentEntity) => void;
  onDesignationCreated?: (designation: FacultyDesignationDefinition) => void;
}

/** Page-header / in-form create modals for department / designation catalogs. */
export function FacultyCatalogCreateOverlays({
  createDepartmentOpen,
  onCloseDepartment,
  createDesignationOpen,
  onCloseDesignation,
  designationDefaultDepartmentId,
  onDepartmentCreated,
  onDesignationCreated,
}: FacultyCatalogCreateOverlaysProps): React.JSX.Element {
  const departmentsController = useFacultyDepartmentsController();
  const designationsController = useFacultyDesignationsController();
  // Department quick-create nested inside the designation modal.
  const [nestedDepartmentOpen, setNestedDepartmentOpen] = useState(false);
  const [nestedDepartmentId, setNestedDepartmentId] = useState<string | undefined>(undefined);

  return (
    <>
      <FacultyDepartmentFormModal
        open={createDepartmentOpen || nestedDepartmentOpen}
        onClose={() => {
          setNestedDepartmentOpen(false);
          if (createDepartmentOpen) onCloseDepartment();
        }}
        department={null}
        existingDepartments={departmentsController.departments}
        isPending={departmentsController.isSaving}
        onSave={async (payload) => {
          const saved = await departmentsController.saveDepartment(payload);
          if (!saved) return false;
          if (nestedDepartmentOpen) setNestedDepartmentId(saved.id);
          else onDepartmentCreated?.(saved);
          return true;
        }}
      />

      <FacultyDesignationFormModal
        open={createDesignationOpen}
        onClose={() => {
          setNestedDepartmentId(undefined);
          onCloseDesignation();
        }}
        designation={null}
        departments={departmentsController.departments}
        designationOptions={designationsController.designations}
        isPending={designationsController.isSaving}
        defaultDepartmentId={nestedDepartmentId ?? designationDefaultDepartmentId}
        onOpenCreateDepartment={() => setNestedDepartmentOpen(true)}
        onSave={async (payload) => {
          const saved = await designationsController.saveDesignation(payload);
          if (!saved) return false;
          onDesignationCreated?.(saved);
          return true;
        }}
      />
    </>
  );
}

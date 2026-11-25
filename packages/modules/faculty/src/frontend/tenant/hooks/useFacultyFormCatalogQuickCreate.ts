import { useState } from "react";

/**
 * In-form department/designation quick-create: open/close state for the
 * nested catalog modals rendered by `FacultyCatalogCreateOverlays`.
 */
export function useFacultyFormCatalogQuickCreate() {
  const [createDepartmentOpen, setCreateDepartmentOpen] = useState(false);
  const [createDesignationOpen, setCreateDesignationOpen] = useState(false);

  return {
    createDepartmentOpen,
    createDesignationOpen,
    openCreateDepartment: () => setCreateDepartmentOpen(true),
    openCreateDesignation: () => setCreateDesignationOpen(true),
    closeDepartment: () => setCreateDepartmentOpen(false),
    closeDesignation: () => setCreateDesignationOpen(false),
  };
}

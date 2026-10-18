import React from "react";
import { studentsTransferSchema, type StudentTransferEntity } from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/app/StandardModuleCsvImportDialog";

export interface StudentsCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Students using SSOT schema. */
export function StudentsCsvImportDialog({
  open,
  onClose,
  canWrite,
}: StudentsCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<StudentTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/students/import"
      schema={studentsTransferSchema}
      navKey="nav.students"
    />
  );
}

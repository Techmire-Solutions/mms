import React from "react";
import { studentsTransferSchema, type StudentTransferEntity } from "@mms/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { StandardModuleCsvImportDialog } from "@mms/fe-core/components/StandardModuleCsvImportDialog";
import { invalidateStudentsQueries } from "../hooks/invalidateStudentsQueries";

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
  const queryClient = useQueryClient();
  return (
    <StandardModuleCsvImportDialog<StudentTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/students/import"
      schema={studentsTransferSchema}
      onSuccess={() => invalidateStudentsQueries(queryClient)}
      navKey="nav.students"
    />
  );
}

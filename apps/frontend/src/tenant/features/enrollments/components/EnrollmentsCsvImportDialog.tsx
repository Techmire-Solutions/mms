import React from "react";
import { enrollmentsTransferSchema, type EnrollmentTransferEntity } from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/ui/StandardModuleCsvImportDialog";

export interface EnrollmentsCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Enrollments using SSOT schema. */
export function EnrollmentsCsvImportDialog({
  open,
  onClose,
  canWrite,
}: EnrollmentsCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<EnrollmentTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/enrollments/import"
      schema={enrollmentsTransferSchema}
      navKey="nav.enrollments"
    />
  );
}

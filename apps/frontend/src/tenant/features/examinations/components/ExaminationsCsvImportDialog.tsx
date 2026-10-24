import React from "react";
import { examinationsTransferSchema, type ExaminationTransferEntity } from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/app/StandardModuleCsvImportDialog";

export interface ExaminationsCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Examinations using SSOT schema. */
export function ExaminationsCsvImportDialog({
  open,
  onClose,
  canWrite,
}: ExaminationsCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<ExaminationTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/examinations/import"
      schema={examinationsTransferSchema}
      navKey="nav.examinations"
    />
  );
}

import React from "react";
import { examinationsTransferSchema, type ExaminationTransferEntity } from "@mms/shared";
import { useQueryClient } from "@tanstack/react-query";
import { StandardModuleCsvImportDialog } from "@/components/app/StandardModuleCsvImportDialog";
import { invalidateExaminationsQueries } from "@/tenant/features/examinations/hooks/invalidateExaminationsQueries";

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
  if (!open || !canWrite) return null;
  return <OpenExaminationsCsvImportDialog open={open} onClose={onClose} canWrite={canWrite} />;
}

function OpenExaminationsCsvImportDialog({
  open,
  onClose,
  canWrite,
}: ExaminationsCsvImportDialogProps): React.JSX.Element {
  const queryClient = useQueryClient();
  return (
    <StandardModuleCsvImportDialog<ExaminationTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/examinations/import"
      schema={examinationsTransferSchema}
      navKey="nav.examinations"
      onSuccess={() => invalidateExaminationsQueries(queryClient)}
    />
  );
}

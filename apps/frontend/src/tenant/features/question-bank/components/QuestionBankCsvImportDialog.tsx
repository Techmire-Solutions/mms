import React from "react";
import { questionBankTransferSchema, type QuestionBankTransferEntity } from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/app/StandardModuleCsvImportDialog";

export interface QuestionBankCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Question Bank using SSOT schema. */
export function QuestionBankCsvImportDialog({
  open,
  onClose,
  canWrite,
}: QuestionBankCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<QuestionBankTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/question-bank/import"
      schema={questionBankTransferSchema}
      navKey="nav.questionBank"
    />
  );
}

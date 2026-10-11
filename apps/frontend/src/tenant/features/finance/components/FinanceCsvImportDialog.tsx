import React from "react";
import { financeTransferSchema, type FinanceTransferEntity } from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/ui/StandardModuleCsvImportDialog";

export interface FinanceCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Finance using SSOT schema. */
export function FinanceCsvImportDialog({
  open,
  onClose,
  canWrite,
}: FinanceCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<FinanceTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/finance/import"
      schema={financeTransferSchema}
      navKey="nav.finance"
    />
  );
}

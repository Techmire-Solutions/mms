import React from "react";
import {
  accountingTransferSchema,
  type AccountingTransferEntity,
} from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/ui/StandardModuleCsvImportDialog";

export interface AccountingCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Accounting using SSOT schema. */
export function AccountingCsvImportDialog({
  open,
  onClose,
  canWrite,
}: AccountingCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<AccountingTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/accounting/import"
      schema={accountingTransferSchema}
      navKey="nav.accounting"
    />
  );
}

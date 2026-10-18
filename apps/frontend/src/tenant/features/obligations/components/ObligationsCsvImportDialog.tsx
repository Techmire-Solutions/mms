import React from "react";
import { obligationsTransferSchema, type ObligationTransferEntity } from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/app/StandardModuleCsvImportDialog";

export interface ObligationsCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Obligations using SSOT schema. */
export function ObligationsCsvImportDialog({
  open,
  onClose,
  canWrite,
}: ObligationsCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<ObligationTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/obligations/import"
      schema={obligationsTransferSchema}
      navKey="nav.obligations"
    />
  );
}

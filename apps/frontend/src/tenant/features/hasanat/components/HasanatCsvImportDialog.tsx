import React from "react";
import { hasanatTransferSchema, type HasanatTransferEntity } from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/app/StandardModuleCsvImportDialog";

export interface HasanatCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Hasanat using SSOT schema. */
export function HasanatCsvImportDialog({
  open,
  onClose,
  canWrite,
}: HasanatCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<HasanatTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/hasanat/import"
      schema={hasanatTransferSchema}
      navKey="nav.hasanatCards"
    />
  );
}

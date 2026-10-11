import React from "react";
import {
  messagingTransferSchema,
  type MessagingTransferEntity,
} from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/ui/StandardModuleCsvImportDialog";

export interface MessagingCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Messaging using SSOT schema. */
export function MessagingCsvImportDialog({
  open,
  onClose,
  canWrite,
}: MessagingCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<MessagingTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/messaging/import"
      schema={messagingTransferSchema}
      navKey="nav.messaging"
    />
  );
}

import React from "react";
import { sessionsTransferSchema, type SessionTransferEntity } from "@mms/contracts";
import { StandardModuleCsvImportDialog } from "@mms/fe-core/components/StandardModuleCsvImportDialog";

export interface SessionsCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Sessions using SSOT schema. */
export function SessionsCsvImportDialog({
  open,
  onClose,
  canWrite,
}: SessionsCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<SessionTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/sessions/import"
      schema={sessionsTransferSchema}
      navKey="nav.sessions"
    />
  );
}

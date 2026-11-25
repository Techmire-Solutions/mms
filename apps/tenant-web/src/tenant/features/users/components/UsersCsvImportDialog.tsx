import React from "react";
import { usersTransferSchema, type UserTransferEntity } from "@mms/contracts";
import { StandardModuleCsvImportDialog } from "@mms/fe-core/components/StandardModuleCsvImportDialog";

export interface UsersCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Users using SSOT schema. */
export function UsersCsvImportDialog({
  open,
  onClose,
  canWrite,
}: UsersCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<UserTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/users/import"
      schema={usersTransferSchema}
      navKey="page.users.title"
    />
  );
}

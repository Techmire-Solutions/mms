import React from "react";
import { usersTransferSchema, type UserTransferEntity } from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/ui/StandardModuleCsvImportDialog";

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

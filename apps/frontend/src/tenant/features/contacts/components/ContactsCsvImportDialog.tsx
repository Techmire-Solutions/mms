import React from "react";
import type { Contact } from "@mms/shared";
import { contactsTransferSchema } from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/ui/StandardModuleCsvImportDialog";

export interface ContactsCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Contacts using SSOT schema. */
export function ContactsCsvImportDialog({
  open,
  onClose,
  canWrite,
}: ContactsCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<Contact>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/contacts/import"
      schema={contactsTransferSchema}
      navKey="nav.contacts"
    />
  );
}

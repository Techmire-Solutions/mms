import React, { useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { BackgroundJobRecord, Contact } from "@mms/contracts";
import { CONTACTS_IMPORT_MAX_BATCH, contactsTransferSchema } from "@mms/contracts";
import { StandardModuleCsvImportDialog } from "@/components/app/StandardModuleCsvImportDialog";
import type {
  ModuleCsvImportProgress,
  ModuleCsvImportSubmitRows,
} from "@/lib/backgroundJobs/useModuleCsvImportActions";
import { chunkContactsForImport } from "@/lib/contacts/contactsImportBatching";
import { startServerContactsImport } from "@/lib/backgroundJobs/startServerContactsImport";
import { useInvalidateContactsQueries } from "@/tenant/features/contacts/hooks/useContactMutations";

export interface ContactsCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/**
 * Keeps the parsed transfer-schema keys and fills the identity fields the import record
 * schema requires (`firstName`), deriving them from the required "Full Name" column.
 */
function toContactImportRow(row: Contact): Contact {
  const name = row.name?.trim() || [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  const [derivedFirstName = "", ...derivedLastNameParts] = name.split(/\s+/).filter(Boolean);
  const firstName = row.firstName?.trim() || derivedFirstName;
  const lastName = row.lastName?.trim() || derivedLastNameParts.join(" ");

  return {
    ...row,
    name: name || firstName,
    firstName,
    ...(lastName ? { lastName } : {}),
  };
}

/**
 * Queues the transfer rows in server-sized batches. A failed batch does not abort the rest:
 * failures are counted and the returned terminal job reports the aggregate outcome so the
 * dialog can reach its "Import complete" state.
 */
async function submitContactRows(
  rows: Contact[],
  onProgress: (progress: ModuleCsvImportProgress) => void,
  t: TranslationFunction,
): Promise<BackgroundJobRecord> {
  const total = rows.length;
  const batches = chunkContactsForImport(rows.map(toContactImportRow), CONTACTS_IMPORT_MAX_BATCH);
  let imported = 0;
  let failed = 0;
  let lastJob: BackgroundJobRecord | null = null;
  let lastError: unknown;

  for (const batch of batches) {
    try {
      const job = await startServerContactsImport({
        contacts: batch,
        label: t("contacts.import.importing", { count: total }),
        // Overall counts across batches: the job reports its own batch progress.
        onProgress: (jobState) => {
          onProgress({ current: imported + (jobState.progress?.current ?? 0), total });
        },
      });
      lastJob = job;
      const batchImported = job.progress?.current ?? batch.length;
      imported += batchImported;
      failed += Math.max(batch.length - batchImported, 0);
    } catch (error) {
      lastError = error;
      failed += batch.length;
    }
    onProgress({ current: imported, total });
  }

  if (!lastJob) {
    throw lastError instanceof Error ? lastError : new Error(t("contacts.import.failed"));
  }

  return {
    ...lastJob,
    label:
      failed > 0
        ? t("contacts.import.importedWithFailures", { imported, total, failed })
        : t("contacts.import.imported", { imported, total }),
    progress: { current: imported, total },
  };
}

/** Standardized CSV import dialog for Contacts using SSOT schema. */
export function ContactsCsvImportDialog({
  open,
  onClose,
  canWrite,
}: ContactsCsvImportDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const invalidateContacts = useInvalidateContactsQueries();
  const submitRows = useCallback<ModuleCsvImportSubmitRows<Contact>>(
    (rows, onProgress) => submitContactRows(rows, onProgress, t),
    [t],
  );

  return (
    <StandardModuleCsvImportDialog<Contact>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/contacts/import"
      schema={contactsTransferSchema}
      submitRows={submitRows}
      onSuccess={invalidateContacts}
      navKey="nav.contacts"
    />
  );
}

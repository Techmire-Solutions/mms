import type { Contact, AppTranslationKey } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notify } from "@/lib/notify";
import { reportClientError } from "@/lib/clientErrorReporting";
import {
  useContactMutations,
  useInvalidateContactsQueries,
} from "@/tenant/features/contacts/hooks/useContactMutations";
import { startServerContactsImport } from "@/lib/backgroundJobs/startServerContactsImport";
import { chunkContactsForImport } from "@/lib/contacts/contactsImportBatching";

type NotifyBulkResult = (
  succeeded: number,
  failed: number,
  singleSuccessKey: AppTranslationKey,
  multiSuccessKey: AppTranslationKey,
) => void;

function extractSavedContact(res: unknown): Contact {
  if (typeof res === "object" && res !== null) {
    if (
      "body" in res &&
      typeof (res as { body?: unknown }).body === "object" &&
      (res as { body?: { contact?: Contact } }).body?.contact
    ) {
      return (res as { body: { contact: Contact } }).body.contact;
    }
    if (
      "contact" in res &&
      typeof (res as { contact?: unknown }).contact === "object" &&
      (res as { contact?: Contact }).contact
    ) {
      return (res as { contact: Contact }).contact;
    }
  }
  return res as Contact;
}

export function useContactsCrudWriteActions({
  t,
  handleError,
  notifyBulkResult,
}: {
  t: TranslationFunction;
  handleError: (err: unknown, scope: string, messageKey?: AppTranslationKey) => void;
  notifyBulkResult: NotifyBulkResult;
}) {
  const {
    upsertContact,
    updateContact,
    mergeContacts: mergeContactsMutation,
    bulkTagContacts: bulkTagMutation,
  } = useContactMutations();
  const invalidateContacts = useInvalidateContactsQueries();

  const saveContact = async (contact: Contact, isNew: boolean): Promise<Contact> => {
    try {
      if (isNew) {
        const res = await upsertContact.mutateAsync(contact);
        return extractSavedContact(res);
      } else {
        const res = await updateContact.mutateAsync({ id: String(contact.id), contact });
        return extractSavedContact(res);
      }
    } catch (err) {
      handleError(err, "contacts.save_contact");
      throw err;
    }
  };

  const mergeContacts = async (
    keepId: string | number,
    deleteId: string | number,
    merged: Contact,
  ): Promise<void> => {
    try {
      await mergeContactsMutation.mutateAsync({
        keepId,
        deleteId,
        merged,
      });
      notify.success(t("contacts.mergeSuccessTitle"), {
        description: t("contacts.mergeSuccessDesc"),
      });
    } catch (err) {
      handleError(err, "contacts.merge_contacts");
      throw err;
    }
  };

  const importContacts = async (
    list: Contact[],
    options?: { onProgress?: (progress: { imported: number; total: number }) => void },
  ): Promise<void> => {
    if (list.length === 0) return;
    let succeeded = 0;
    let failed = 0;
    try {
      // One queued job per batch instead of one REST write per contact. A batch is capped
      // server-side (`CONTACTS_IMPORT_MAX_BATCH`), so larger vCards are chunked here.
      for (const batch of chunkContactsForImport(list)) {
        const alreadyDone = succeeded + failed;
        const job = await startServerContactsImport({
          contacts: batch,
          label: t("contacts.jobs.importLabelServer"),
          // Overall counts across batches: the job reports its own batch progress.
          onProgress: (jobState) =>
            options?.onProgress?.({
              imported: alreadyDone + (jobState.progress?.current ?? 0),
              total: list.length,
            }),
        });
        const imported = job.progress?.current ?? batch.length;
        succeeded += imported;
        failed += Math.max(batch.length - imported, 0);
        options?.onProgress?.({ imported: succeeded + failed, total: list.length });
      }
    } catch (err) {
      failed = list.length - succeeded;
      reportClientError(err, { scope: "contacts.import_job" });
    } finally {
      if (succeeded > 0) invalidateContacts();
    }
    notifyBulkResult(succeeded, failed, "contacts.importSuccessOne", "contacts.importSuccess");
  };

  const bulkTagContacts = async (
    ids: string[],
    addTags?: string[],
    removeTags?: string[],
  ): Promise<number> => {
    try {
      const res = await bulkTagMutation.mutateAsync({ ids, addTags, removeTags });
      notify.success(t("contacts.bulkTagSuccess", { count: res.updatedCount }));
      return res.updatedCount;
    } catch (err) {
      handleError(err, "contacts.bulk_tag");
      throw err;
    }
  };

  return {
    updateContact,
    saveContact,
    mergeContacts,
    importContacts,
    bulkTagContacts,
  };
}

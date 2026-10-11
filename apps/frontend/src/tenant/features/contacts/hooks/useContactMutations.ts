import { useQueryClient } from "@tanstack/react-query";
import {
  type Contact,
  type ContactIdentityMatchBody,
  type ContactIdentityMatchResult,
} from "@mms/shared";
import { tsrClient } from "@/lib/api";
import { enqueueContactsOutbox } from "@/lib/contacts/contactsSyncOutbox";
import {
  useContactsContractRestore,
  useContactsContractBulkDelete,
  useContactsContractBulkRestore,
  useContactsContractLogExportAudit,
  useContactsContractLogSetupAudit,
} from "@/tenant/features/contacts/hooks/useContactsTsrHooks";
import { invalidateContactsQueries } from "@/tenant/features/contacts/hooks/invalidateContactsQueries";
import { unwrapContactMutationBody } from "@/tenant/features/contacts/hooks/contactMutationResponse";

type ContactSuccessResponse = { success: true };
type ContactWrappedResponse = ContactSuccessResponse & { contact: Contact };
type ContactBulkResult = ContactSuccessResponse & { succeeded: number; failed: number };
type ContactBulkRestoreResult = ContactBulkResult & {
  conflicts: Array<{ id: string; errors: Array<{ field: string; message: string }> }>;
};
type ContactBulkTagResult = ContactSuccessResponse & { updatedCount: number };

export function useInvalidateContactsQueries() {
  const queryClient = useQueryClient();
  return () => invalidateContactsQueries(queryClient);
}

/**
 * Server mutations for Contact records. Bulk-delete/restore/audit use ts-rest contracts;
 * create/update/delete/merge use tsrClient.contacts.
 */
export function useContactMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateContactsQueries(queryClient);

  const bulkDeleteMutation = useContactsContractBulkDelete();
  const restoreMutation = useContactsContractRestore();
  const bulkRestoreMutation = useContactsContractBulkRestore();
  const logExportAuditMutation = useContactsContractLogExportAudit();
  const logSetupAuditMutation = useContactsContractLogSetupAudit();

  const upsertContactMutation = tsrClient.contacts.create.useMutation({
    onSuccess: invalidate,
  });

  const updateContactMutation = tsrClient.contacts.update.useMutation({
    onSuccess: invalidate,
  });

  const deleteContactMutation = tsrClient.contacts.delete.useMutation({
    onSuccess: invalidate,
  });

  const mergeContactsMutation = tsrClient.contacts.merge.useMutation({
    onSuccess: invalidate,
  });

  const matchContactIdentity = tsrClient.contacts.identityMatch.useMutation();

  const bulkTagContactsMutation = tsrClient.contacts.bulkTag.useMutation({
    onSuccess: invalidate,
  });

  return {
    upsertContact: {
      ...upsertContactMutation,
      mutateAsync: async (contact: Contact) => {
        try {
          const response = await upsertContactMutation.mutateAsync({ body: contact });
          return unwrapContactMutationBody<ContactWrappedResponse>(response);
        } catch (error) {
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            enqueueContactsOutbox({ kind: "upsert", contact });
          }
          throw error;
        }
      },
    },
    updateContact: {
      ...updateContactMutation,
      mutateAsync: async ({ id, contact }: { id: string; contact: Contact }) => {
        try {
          const response = await updateContactMutation.mutateAsync({
            params: { id },
            body: contact,
          });
          return unwrapContactMutationBody<ContactWrappedResponse>(response);
        } catch (error) {
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            enqueueContactsOutbox({ kind: "update", contactId: id, contact });
          }
          throw error;
        }
      },
    },
    deleteContact: {
      ...deleteContactMutation,
      mutateAsync: async ({ id, deletionReason }: { id: string; deletionReason?: string }) => {
        try {
          const response = await deleteContactMutation.mutateAsync({
            params: { id },
            body: deletionReason ? { deletionReason } : {},
          });
          return unwrapContactMutationBody<ContactSuccessResponse>(response);
        } catch (error) {
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            enqueueContactsOutbox({ kind: "delete", contactId: id, deletionReason });
          }
          throw error;
        }
      },
    },
    bulkDeleteContacts: {
      mutateAsync: async (payload: { ids: string[]; deletionReason?: string }) => {
        const response = await bulkDeleteMutation.mutateAsync({ body: payload });
        return unwrapContactMutationBody<ContactBulkResult>(response);
      },
      isPending: bulkDeleteMutation.isPending,
    },
    restoreContact: {
      mutateAsync: async (id: string) => {
        const response = await restoreMutation.mutateAsync({ params: { id } });
        return unwrapContactMutationBody<ContactWrappedResponse>(response);
      },
      isPending: restoreMutation.isPending,
    },
    bulkRestoreContacts: {
      mutateAsync: async (ids: string[]) => {
        const response = await bulkRestoreMutation.mutateAsync({ body: { ids } });
        return unwrapContactMutationBody<ContactBulkRestoreResult>(response);
      },
      isPending: bulkRestoreMutation.isPending,
    },
    mergeContacts: {
      ...mergeContactsMutation,
      mutateAsync: async (payload: {
        keepId: string | number;
        deleteId: string | number;
        merged?: Contact;
      }) => {
        const response = await mergeContactsMutation.mutateAsync({ body: payload });
        return unwrapContactMutationBody<ContactWrappedResponse>(response);
      },
    },
    matchContactIdentity: {
      ...matchContactIdentity,
      mutateAsync: async (body: ContactIdentityMatchBody) => {
        const response = await matchContactIdentity.mutateAsync({ body });
        return unwrapContactMutationBody<ContactIdentityMatchResult>(response);
      },
    },
    bulkTagContacts: {
      ...bulkTagContactsMutation,
      mutateAsync: async (payload: {
        ids: string[];
        addTags?: string[];
        removeTags?: string[];
      }) => {
        const response = await bulkTagContactsMutation.mutateAsync({ body: payload });
        return unwrapContactMutationBody<ContactBulkTagResult>(response);
      },
    },
    logExportAudit: {
      mutateAsync: async (payload: { count: number; scope: "all" | "filtered" | "selection" }) => {
        const response = await logExportAuditMutation.mutateAsync({ body: payload });
        return unwrapContactMutationBody<ContactSuccessResponse>(response);
      },
      isPending: logExportAuditMutation.isPending,
    },
    logSetupAudit: {
      mutateAsync: async (payload: { area: "fields" | "preferences"; summary: string }) => {
        const response = await logSetupAuditMutation.mutateAsync({ body: payload });
        return unwrapContactMutationBody<ContactSuccessResponse>(response);
      },
      isPending: logSetupAuditMutation.isPending,
    },
  };
}

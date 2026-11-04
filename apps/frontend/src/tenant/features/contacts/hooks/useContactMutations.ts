import { useQueryClient } from "@tanstack/react-query";
import {
  type Contact,
  type ContactIdentityMatchBody,
  type ContactIdentityMatchResult,
  type ValidationError,
} from "@mms/shared";
import { tsrClient } from "@/lib/api";
import {
  enqueueContactsOutbox,
  isRetryableContactsOutboxError,
} from "@/lib/contacts/contactsSyncOutbox";
import {
  useContactsContractRestore,
  useContactsContractBulkDelete,
  useContactsContractBulkRestore,
} from "@/tenant/features/contacts/hooks/useContactsQueries";
import { invalidateContactsQueries } from "@/tenant/features/contacts/hooks/invalidateContactsQueries";
import { unwrapContactMutationBody } from "@/tenant/features/contacts/hooks/contactMutationResponse";

type ContactSuccessResponse = { success: true };
type ContactWrappedResponse = ContactSuccessResponse & { contact: Contact };
type ContactBulkResult = ContactSuccessResponse & { succeeded: number; failed: number };
type ContactBulkRestoreResult = ContactBulkResult & {
  /** Server field issues are `ValidationError` (`fieldId`/`tabId`/`message`), not `field`. */
  conflicts: Array<{ id: string; errors: ValidationError[] }>;
};
type ContactBulkTagResult = ContactSuccessResponse & { updatedCount: number };

/**
 * Queue a write for replay when it may succeed later.
 *
 * `navigator.onLine` alone misses captive portals/VPN drops and 5xx deploys; those
 * transport failures are exactly what the outbox exists for. Validation/conflict
 * errors (4xx) are real failures and are never queued.
 */
export function shouldQueueContactWrite(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return isRetryableContactsOutboxError(error);
}

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
          const response = await upsertContactMutation.mutateAsync({
            body: contact,
            // Versioned upsert: an offline replay of an existing contact must
            // prove which version it is based on, or the server 409s every retry.
            ...(contact.updatedAt
              ? { headers: { "x-expected-updated-at": contact.updatedAt } }
              : {}),
          });
          return unwrapContactMutationBody<ContactWrappedResponse>(response);
        } catch (error) {
          if (shouldQueueContactWrite(error)) {
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
            // Optimistic concurrency: the contact still carries the `updatedAt`
            // the form was opened with, so the server can reject a save that
            // would silently overwrite another editor's change (409).
            ...(contact.updatedAt
              ? { headers: { "x-expected-updated-at": contact.updatedAt } }
              : {}),
          });
          return unwrapContactMutationBody<ContactWrappedResponse>(response);
        } catch (error) {
          if (shouldQueueContactWrite(error)) {
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
          if (shouldQueueContactWrite(error)) {
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
        /** `updatedAt` of the survivor the preview was computed from (409 guard). */
        keepUpdatedAt?: string;
      }) => {
        const { keepUpdatedAt, ...body } = payload;
        const response = await mergeContactsMutation.mutateAsync({
          body,
          ...(keepUpdatedAt ? { headers: { "x-expected-updated-at": keepUpdatedAt } } : {}),
        });
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
  };
}

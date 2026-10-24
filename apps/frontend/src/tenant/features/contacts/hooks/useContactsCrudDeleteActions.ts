import type { AppTranslationKey } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notify } from "@/lib/notify";
import { useContactMutations } from "@/tenant/features/contacts/hooks/useContacts";

type NotifyBulkResult = (
  succeeded: number,
  failed: number,
  singleSuccessKey: AppTranslationKey,
  multiSuccessKey: AppTranslationKey,
) => void;

export function useContactsCrudDeleteActions({
  t,
  handleError,
  notifyBulkResult,
  notifyArchivedWithUndo,
}: {
  t: TranslationFunction;
  handleError: (err: unknown, scope: string, messageKey?: AppTranslationKey) => void;
  notifyBulkResult: NotifyBulkResult;
  notifyArchivedWithUndo?: (
    onUndo: () => void | Promise<void>,
    recordName?: string,
    options?: { description?: string },
  ) => unknown;
}) {
  const {
    deleteContact,
    bulkDeleteContacts: bulkDeleteMutation,
    bulkRestoreContacts: bulkRestoreMutation,
    restoreContact: restoreMutation,
  } = useContactMutations();

  const removeContact = async (
    id: string | number,
    name?: string,
    deletionReason?: string,
  ): Promise<void> => {
    try {
      await deleteContact.mutateAsync({
        id: String(id),
        ...(deletionReason ? { deletionReason } : {}),
      });
      if (notifyArchivedWithUndo) {
        notifyArchivedWithUndo(() => restoreContactAction(String(id)), name);
      } else {
        notify.info(t("contacts.deletedTitle"), {
          description: name
            ? t("contacts.deletedDescription", { name })
            : t("contacts.deletedDescriptionDefault"),
        });
      }
    } catch (err) {
      handleError(err, "contacts.remove_contact");
    }
  };

  const bulkDeleteContactsAction = async (
    ids: (string | number)[],
    deletionReason?: string,
  ): Promise<void> => {
    if (ids.length === 0) return;
    try {
      const result = await bulkDeleteMutation.mutateAsync({
        ids: ids.map(String),
        ...(deletionReason ? { deletionReason } : {}),
      });
      notifyBulkResult(
        result.succeeded,
        result.failed,
        "contacts.deletedTitle",
        "contacts.bulkDeleteSuccess",
      );
    } catch (err) {
      handleError(err, "contacts.bulk_delete");
    }
  };

  const restoreContactAction = async (id: string): Promise<void> => {
    await restoreMutation.mutateAsync(id);
  };

  const bulkRestoreContactsAction = async (
    ids: (string | number)[],
  ): Promise<{
    succeeded: number;
    failed: number;
    conflicts?: Array<{ id: string; errors: Array<{ message: string }> }>;
  }> => {
    return bulkRestoreMutation.mutateAsync(ids.map(String));
  };

  return {
    removeContact,
    bulkDeleteContactsAction,
    restoreContactAction,
    bulkRestoreContactsAction,
  };
}

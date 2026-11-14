import type { ObligationCollection } from "@mms/shared";
import { toMessagingRecipient } from "@mms/shared";
import { notify } from "@/lib/notify";
import { apiErrorMessage } from "@/lib/apiErrorMessage";
import { isConflictError } from "@/lib/apiContractError";
import {
  NotifiedObligationsMutationError,
  type useObligationsMutations,
} from "@/tenant/features/obligations/hooks/useObligationsApi";
import { useObligationsTrashActions } from "@/tenant/features/obligations/hooks/useObligationsTrashActions";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { UseMessageComposerStateResult } from "@/hooks/useMessageComposerState";

interface UseObligationsPageActionsParams {
  t: TranslationFunction;
  replaceCollections: ReturnType<typeof useObligationsMutations>["replaceCollections"];
  deleteCollection: ReturnType<typeof useObligationsMutations>["deleteCollection"];
  restoreCollection: ReturnType<typeof useObligationsMutations>["restoreCollection"];
  bulkDeleteCollections: ReturnType<typeof useObligationsMutations>["bulkDeleteCollections"];
  bulkRestoreCollections: ReturnType<typeof useObligationsMutations>["bulkRestoreCollections"];
  clearCollectionSelection: () => void;
  setShowForm: (show: boolean) => void;
  openComposer: UseMessageComposerStateResult["openComposer"];
  canWriteMessaging: boolean;
  /** Reloads the directory after a conflict, so the user can see what changed. */
  refetchCollections: () => void;
}

export function useObligationsPageActions({
  t,
  replaceCollections,
  deleteCollection,
  restoreCollection,
  bulkDeleteCollections,
  bulkRestoreCollections,
  clearCollectionSelection,
  setShowForm,
  openComposer,
  canWriteMessaging,
  refetchCollections,
}: UseObligationsPageActionsParams) {
  const notifySaveFailure = (error: unknown) => {
    if (error instanceof NotifiedObligationsMutationError) return;
    notify.error(t("obligations.saveFailed"), {
      description: apiErrorMessage(error, t("errors.state.generic")),
    });
  };

  const handleMessageCollections = (
    channel: "sms" | "whatsapp" | "email",
    collectionList: ObligationCollection[],
  ) => {
    if (!canWriteMessaging) return;
    openComposer(
      channel,
      collectionList.map((collection) =>
        toMessagingRecipient({
          id: collection.id,
          name: collection.receipt_no
            ? t("obligations.messaging.receipt", { receipt: collection.receipt_no })
            : t("obligations.messaging.donor"),
          phone:
            typeof (collection as { phone?: string }).phone === "string"
              ? (collection as { phone?: string }).phone
              : "",
          email:
            typeof (collection as { email?: string }).email === "string"
              ? (collection as { email?: string }).email
              : "",
        }),
      ),
    );
  };

  const handleSaveCollection = async (collectionPayload: ObligationCollection) => {
    try {
      // Send **one** record: the endpoint upserts by `(workspace, id)` and bumps `version` for
      // every row in the payload, so the previously-sent whole directory made one create stale
      // every other receipt (spurious 409s for other sessions) and shipped up to 2 000 rows per
      // save. The contract is named `replaceCollections`, but the server never deletes — sending
      // the directory would be data loss the day that name is honoured.
      await replaceCollections.mutateAsync([collectionPayload]);
      setShowForm(false);
    } catch (error: unknown) {
      // Two different 409s reach this catch, and they need different copy:
      //  - `stale_write`: the OCC token lost a race → refresh and offer the current version.
      //  - `conflict`: the unique receipt-number index rejected a duplicate → the number must
      //    change; refreshing would not help. Receipt numbers are generated client-side from the
      //    loaded list, so a collision is the expected failure, not a race.
      const conflictType = (error as { type?: unknown } | null)?.type;
      if (conflictType === "stale_write") {
        refetchCollections();
        notify.error(t("obligations.saveConflict"), {
          description: apiErrorMessage(error, t("errors.state.generic")),
        });
        throw error;
      }
      if (isConflictError(error) && conflictType === "conflict") {
        notify.error(t("obligations.saveDuplicateReceipt"), {
          description: apiErrorMessage(error, t("errors.state.generic")),
        });
        throw error;
      }
      notifySaveFailure(error);
      throw error;
    }
  };

  const {
    handleDelete,
    handleRestore,
    handleBulkDelete: rawBulkDelete,
    handleBulkRestore: rawBulkRestore,
  } = useObligationsTrashActions({
    t,
    deleteCollection,
    restoreCollection,
    bulkDeleteCollections,
    bulkRestoreCollections,
  });

  const handleBulkDelete = async (ids: string[]) => {
    await rawBulkDelete(ids);
    clearCollectionSelection();
  };

  const handleBulkRestore = async (ids: string[]) => {
    await rawBulkRestore(ids);
    clearCollectionSelection();
  };

  const runSetupSave = async (save: () => Promise<unknown>): Promise<void> => {
    try {
      await save();
    } catch (error: unknown) {
      notifySaveFailure(error);
      throw error;
    }
  };

  return {
    handleMessageCollections,
    handleSaveCollection,
    handleDelete,
    handleRestore,
    handleBulkDelete,
    handleBulkRestore,
    runSetupSave,
  };
}

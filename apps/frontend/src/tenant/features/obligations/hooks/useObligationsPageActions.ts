import type { ObligationCollection } from "@mms/shared";
import { toMessagingRecipient } from "@mms/shared";
import { notify } from "@/lib/notify";
import {
  NotifiedObligationsMutationError,
  type useObligationsMutations,
} from "@/tenant/features/obligations/hooks/useObligationsApi";
import { useObligationsTrashActions } from "@/tenant/features/obligations/hooks/useObligationsTrashActions";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { UseMessageComposerStateResult } from "@/hooks/useMessageComposerState";

interface UseObligationsPageActionsParams {
  t: TranslationFunction;
  collections: ObligationCollection[];
  replaceCollections: ReturnType<typeof useObligationsMutations>["replaceCollections"];
  deleteCollection: ReturnType<typeof useObligationsMutations>["deleteCollection"];
  restoreCollection: ReturnType<typeof useObligationsMutations>["restoreCollection"];
  bulkDeleteCollections: ReturnType<typeof useObligationsMutations>["bulkDeleteCollections"];
  bulkRestoreCollections: ReturnType<typeof useObligationsMutations>["bulkRestoreCollections"];
  clearCollectionSelection: () => void;
  setShowForm: (show: boolean) => void;
  openComposer: UseMessageComposerStateResult["openComposer"];
  canWriteMessaging: boolean;
}

export function useObligationsPageActions({
  t,
  collections,
  replaceCollections,
  deleteCollection,
  restoreCollection,
  bulkDeleteCollections,
  bulkRestoreCollections,
  clearCollectionSelection,
  setShowForm,
  openComposer,
  canWriteMessaging,
}: UseObligationsPageActionsParams) {
  const notifySaveFailure = (error: unknown) => {
    if (error instanceof NotifiedObligationsMutationError) return;
    notify.error(t("obligations.saveFailed"), {
      description: error instanceof Error ? error.message : String(error),
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
      const existingCollection = collections.find((c) => c.id === collectionPayload.id);
      await replaceCollections.mutateAsync(
        existingCollection
          ? collections.map((c) => (c.id === collectionPayload.id ? collectionPayload : c))
          : [collectionPayload, ...collections],
      );
      setShowForm(false);
    } catch (error: unknown) {
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

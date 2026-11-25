import { useContactsCrudNotify } from "./useContactsCrudNotify.js";
import { useContactsCrudWriteActions } from "./useContactsCrudWriteActions.js";
import { useContactsCrudDeleteActions } from "./useContactsCrudDeleteActions.js";

export function useContactsCrudActions() {
  const { t, handleError, notifyBulkResult, notifyArchivedWithUndo } = useContactsCrudNotify();
  const write = useContactsCrudWriteActions({ t, handleError, notifyBulkResult });
  const remove = useContactsCrudDeleteActions({
    t,
    notifyBulkResult,
    notifyArchivedWithUndo,
  });

  return {
    updateContact: write.updateContact,
    handleError,
    notifyBulkResult,
    saveContact: write.saveContact,
    removeContact: remove.removeContact,
    mergeContacts: write.mergeContacts,
    importContacts: write.importContacts,
    bulkTagContacts: write.bulkTagContacts,
    bulkDeleteContactsAction: remove.bulkDeleteContactsAction,
    restoreContactAction: remove.restoreContactAction,
    bulkRestoreContactsAction: remove.bulkRestoreContactsAction,
  };
}

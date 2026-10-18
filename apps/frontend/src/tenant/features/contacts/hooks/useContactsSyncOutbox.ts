import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearContactsSyncConflicts,
  flushContactsOutbox,
  getContactsOutbox,
  getContactsSyncConflicts,
  OUTBOX_KEY,
  CONFLICTS_KEY,
} from "@/lib/contacts/contactsSyncOutbox";
import {
  useContactMutations,
  CONTACTS_QUERY_KEY,
} from "@/tenant/features/contacts/hooks/useContacts";
import { queryClientInstance } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";

export function useContactsSyncOutbox() {
  const { t } = useTranslation();
  const { upsertContact, updateContact, deleteContact } = useContactMutations();
  const [pendingCount, setPendingCount] = useState(() => getContactsOutbox().length);
  const [conflictCount, setConflictCount] = useState(() => getContactsSyncConflicts().length);
  const [flushing, setFlushing] = useState(false);
  const userInitiatedFlush = useRef(false);

  const refreshCounts = useCallback(() => {
    setPendingCount(getContactsOutbox().length);
    setConflictCount(getContactsSyncConflicts().length);
  }, []);

  useEffect(() => {
    const handler = () => refreshCounts();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === OUTBOX_KEY || event.key === CONFLICTS_KEY) {
        refreshCounts();
      }
    };

    window.addEventListener("contacts-sync-outbox-changed", handler);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("contacts-sync-outbox-changed", handler);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshCounts]);

  const flush = useCallback(
    async (options?: { notify?: boolean }) => {
      if (flushing || getContactsOutbox().length === 0) return null;
      setFlushing(true);
      try {
        const result = await flushContactsOutbox({
          upsert: (contact) => upsertContact.mutateAsync(contact).then(() => undefined),
          update: (contactId, contact) =>
            updateContact.mutateAsync({ id: contactId, contact }).then(() => undefined),
          delete: (contactId, deletionReason) =>
            deleteContact.mutateAsync({ id: contactId, deletionReason }).then(() => undefined),
        });
        await queryClientInstance.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
        refreshCounts();

        const shouldNotify = options?.notify ?? userInitiatedFlush.current;
        userInitiatedFlush.current = false;

        if (shouldNotify && result) {
          if (result.failed === 0 && result.synced > 0) {
            notify.success(t("contacts.sync.flushSuccess"), {
              description: t("contacts.sync.flushSuccessDesc", { count: result.synced }),
            });
          } else if (result.failed > 0) {
            notify.error(t("contacts.sync.flushPartial"), {
              description: t("contacts.sync.flushPartialDesc", {
                synced: result.synced,
                failed: result.failed,
              }),
            });
          }
        }

        return result;
      } finally {
        setFlushing(false);
      }
    },
    [deleteContact, flushing, refreshCounts, t, updateContact, upsertContact],
  );

  const flushManual = async () => {
    userInitiatedFlush.current = true;
    return flush({ notify: true });
  };

  useEffect(() => {
    const onOnline = () => {
      void flush({ notify: true });
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  return {
    pendingCount,
    conflictCount,
    flushing,
    flush: flushManual,
    clearConflicts: clearContactsSyncConflicts,
    refreshCounts,
  };
}

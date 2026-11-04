import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearContactsSyncConflicts,
  currentContactsSyncKeys,
  flushContactsOutbox,
  getContactsOutbox,
  getContactsSyncConflicts,
} from "@/lib/contacts/contactsSyncOutbox";
import {
  useContactMutations,
  CONTACTS_QUERY_KEY,
} from "@/tenant/features/contacts/hooks/useContacts";
import { queryClientInstance } from "@/lib/queryClient";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";

/** Backoff before an automatic retry after the server was unreachable/overloaded. */
const CONTACTS_SYNC_RETRY_DELAY_MS = 30_000;

export function useContactsSyncOutbox() {
  const { t } = useTranslation();
  const { upsertContact, updateContact, deleteContact } = useContactMutations();
  const [pendingCount, setPendingCount] = useState(() => getContactsOutbox().length);
  const [conflictCount, setConflictCount] = useState(() => getContactsSyncConflicts().length);
  const [flushing, setFlushing] = useState(false);
  const userInitiatedFlush = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const flushRef = useRef<((options?: { notify?: boolean }) => Promise<unknown>) | null>(null);

  const refreshCounts = useCallback(() => {
    setPendingCount(getContactsOutbox().length);
    setConflictCount(getContactsSyncConflicts().length);
  }, []);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handler = () => refreshCounts();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null) {
        refreshCounts();
        return;
      }
      const keys = currentContactsSyncKeys();
      if (event.key === keys.outbox || event.key === keys.conflicts) {
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
      if (flushing || getContactsOutbox().length === 0) {
        userInitiatedFlush.current = false;
        return null;
      }
      setFlushing(true);
      try {
        const result = await flushContactsOutbox({
          upsert: (contact) => upsertContact.mutateAsync(contact).then(() => undefined),
          update: (contactId, contact) =>
            updateContact.mutateAsync({ id: contactId, contact }).then(() => undefined),
          delete: (contactId, deletionReason) =>
            deleteContact.mutateAsync({ id: contactId, deletionReason }).then(() => undefined),
        });
        // Joined callers attached to the owner's flush; it already invalidated.
        if (!result?.joined) {
          await queryClientInstance.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
        }
        refreshCounts();

        if (!result?.joined) {
          if (result?.retryable) {
            // The server did not decide anything (offline/5xx); keep the queue and
            // retry on a timer instead of asking the user to resolve "conflicts".
            clearRetryTimer();
            retryTimerRef.current = window.setTimeout(() => {
              retryTimerRef.current = null;
              void flushRef.current?.({ notify: false });
            }, CONTACTS_SYNC_RETRY_DELAY_MS);
          } else {
            clearRetryTimer();
          }
        }

        const shouldNotify = (options?.notify ?? userInitiatedFlush.current) && !result?.joined;
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
          } else if (result.retryable > 0) {
            notify.info(t("contacts.sync.retryScheduled", { count: result.retryable }));
          }
        }

        return result;
      } finally {
        setFlushing(false);
      }
    },
    [clearRetryTimer, deleteContact, flushing, refreshCounts, t, updateContact, upsertContact],
  );

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => clearRetryTimer, [clearRetryTimer]);

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

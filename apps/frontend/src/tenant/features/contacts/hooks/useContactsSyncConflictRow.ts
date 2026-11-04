import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Contact } from "@mms/shared";
import {
  defaultSyncFieldPicks,
  diffContactForSync,
  mergeContactForSync,
  resolveSyncConflictContactId,
  type SyncFieldPick,
} from "@mms/shared";
import type { ContactsSyncConflict } from "@/lib/contacts/contactsSyncOutbox";
import {
  dismissContactsSyncConflict,
  requeueContactsSyncConflict,
} from "@/lib/contacts/contactsSyncOutbox";
import { MAX_CONTACTS_SYNC_CONFLICT_ATTEMPTS } from "@/lib/contacts/contactsSyncOutboxStorage";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactById, useContactMutations } from "@/tenant/features/contacts/hooks/useContacts";
import { contactDetailQueryKey } from "@/tenant/features/contacts/hooks/contactsQueryKeys";
import { fetchContactById } from "@/tenant/features/contacts/hooks/contactsListQueryBuilders";
import { notify } from "@/lib/notify";

function localContactFromEntry(entry: ContactsSyncConflict): Contact | undefined {
  if (entry.kind === "upsert" || entry.kind === "update") return entry.contact;
  return undefined;
}

export function useContactsSyncConflictRow({
  entry,
  onResolved,
}: {
  entry: ContactsSyncConflict;
  onResolved: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { updateContact, upsertContact, deleteContact } = useContactMutations();
  const [expanded, setExpanded] = useState(false);
  const [applying, setApplying] = useState(false);
  const [fieldPicks, setFieldPicks] = useState<Record<string, SyncFieldPick>>({});

  const local = localContactFromEntry(entry);
  const contactId = resolveSyncConflictContactId(entry);
  const { data: serverContact, isFetching: serverLoading } = useContactById(
    contactId,
    expanded && Boolean(contactId),
  );

  /**
   * Current server record for the rebase. `fetchQuery` with `staleTime: 0` bypasses
   * the cached detail copy that produced the conflict in the first place.
   */
  const loadFreshServerContact = async (): Promise<Contact | undefined> => {
    if (!contactId) return undefined;
    try {
      return (
        (await queryClient.fetchQuery({
          queryKey: contactDetailQueryKey(contactId),
          queryFn: ({ signal }) => fetchContactById(contactId, signal),
          staleTime: 0,
        })) ?? undefined
      );
    } catch {
      return undefined;
    }
  };

  const diffs = (() => {
    if (!local) return [];
    return diffContactForSync(local, serverContact);
  })();

  const effectiveFieldPicks = useMemo(() => {
    if (Object.keys(fieldPicks).length > 0) return fieldPicks;
    if (expanded && !serverLoading && diffs.length > 0) {
      return defaultSyncFieldPicks(diffs);
    }
    return fieldPicks;
  }, [expanded, serverLoading, diffs, fieldPicks]);

  const togglePick = (field: string, pick: SyncFieldPick) => {
    setFieldPicks((prev) => {
      const base = Object.keys(prev).length > 0 ? prev : defaultSyncFieldPicks(diffs);
      return { ...base, [field]: pick };
    });
  };

  const handleKeepMine = async () => {
    setApplying(true);
    try {
      if ((entry.attempts ?? 0) >= MAX_CONTACTS_SYNC_CONFLICT_ATTEMPTS) {
        notify.error(t("contacts.saveFailed"), {
          description: t("contacts.sync.conflictRetryLimit"),
        });
        return;
      }
      // A 409 cannot be resolved by replaying the same stale token: rebase the local
      // values onto the current server record before re-queueing (R4-08).
      const fresh = await loadFreshServerContact();
      if (contactId && !fresh && local) {
        notify.error(t("contacts.saveFailed"), {
          description: t("contacts.sync.conflictNoServer"),
        });
        return;
      }
      // The blueprint version the user's form saw is stale by definition here; drop it
      // so the server's current required-field rules decide instead of a reload error.
      const { _blueprintId: _staleBlueprint, ...localFields } = (local ?? {}) as Contact & {
        _blueprintId?: string;
      };
      const rebased = local && fresh ? { ...localFields, updatedAt: fresh.updatedAt } : undefined;
      requeueContactsSyncConflict(entry.id, rebased);
      onResolved();
      notify.info(t("contacts.sync.conflictKeepLocal"));
    } finally {
      setApplying(false);
    }
  };

  const handleUseServer = () => {
    dismissContactsSyncConflict(entry.id);
    onResolved();
    notify.info(t("contacts.sync.conflictUseServer"));
  };

  const handleApplyMerge = async () => {
    if (!local) return;
    setApplying(true);
    try {
      const merged = mergeContactForSync(local, serverContact, effectiveFieldPicks);
      if (entry.kind === "upsert") {
        await upsertContact.mutateAsync(merged);
      } else if (entry.kind === "update") {
        await updateContact.mutateAsync({ id: String(merged.id), contact: merged });
      } else if (entry.kind === "delete" && contactId) {
        await deleteContact.mutateAsync({ id: contactId });
      }
      dismissContactsSyncConflict(entry.id);
      onResolved();
      notify.success(t("contacts.sync.conflictMergeSuccess"));
    } catch {
      notify.error(t("contacts.saveFailed"));
    } finally {
      setApplying(false);
    }
  };

  return {
    expanded,
    setExpanded,
    applying,
    fieldPicks: effectiveFieldPicks,
    local,
    serverContact,
    serverLoading,
    diffs,
    togglePick,
    handleKeepMine,
    handleUseServer,
    handleApplyMerge,
  };
}

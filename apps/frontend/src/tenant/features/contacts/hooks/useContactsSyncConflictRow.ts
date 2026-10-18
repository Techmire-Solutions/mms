import { useEffect, useState } from "react";
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
import { useTranslation } from "@/hooks/useTranslation";
import { useContactById, useContactMutations } from "@/tenant/features/contacts/hooks/useContacts";
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

  const diffs = (() => {
    if (!local) return [];
    return diffContactForSync(local, serverContact);
  })();

  useEffect(() => {
    if (expanded && !serverLoading && diffs.length > 0 && Object.keys(fieldPicks).length === 0) {
      setFieldPicks(defaultSyncFieldPicks(diffs));
    }
  }, [expanded, serverLoading, diffs, fieldPicks]);

  const togglePick = (field: string, pick: SyncFieldPick) => {
    setFieldPicks((prev) => ({ ...prev, [field]: pick }));
  };

  const handleKeepMine = async () => {
    setApplying(true);
    try {
      requeueContactsSyncConflict(entry.id);
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
      const merged = mergeContactForSync(local, serverContact, fieldPicks);
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
    fieldPicks,
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

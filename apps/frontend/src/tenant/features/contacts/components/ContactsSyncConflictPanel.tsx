import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { ContactsSyncConflict } from "@/lib/contacts/contactsSyncOutbox";
import {
  describeContactsOutboxEntry,
  dismissContactsSyncConflict,
  getContactsSyncConflicts,
  requeueAllContactsSyncConflicts,
} from "@/lib/contacts/contactsSyncOutbox";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactsSyncOutbox } from "@/tenant/features/contacts/hooks/useContactsSyncOutbox";
import { FormModal } from "@/components/app/FormModal";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { notify } from "@/lib/notify";
import { ContactsSyncConflictRow } from "@/tenant/features/contacts/components/ContactsSyncConflictRow";

export interface ContactsSyncConflictPanelProps {
  open: boolean;
  onClose: () => void;
}

/** Review panel for offline sync conflicts. */
export function ContactsSyncConflictPanel({
  open,
  onClose,
}: ContactsSyncConflictPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const { flush, refreshCounts } = useContactsSyncOutbox();
  const [conflicts, setConflicts] = useState<ContactsSyncConflict[]>(() =>
    getContactsSyncConflicts(),
  );
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [dismissTargetId, setDismissTargetId] = useState<string | null>(null);

  const refreshList = useCallback(() => {
    setConflicts(getContactsSyncConflicts());
    refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    if (!open) return;
    refreshList();
  }, [open, refreshList]);

  useEffect(() => {
    const handler = () => refreshList();
    window.addEventListener("contacts-sync-outbox-changed", handler);
    return () => window.removeEventListener("contacts-sync-outbox-changed", handler);
  }, [refreshList]);

  const handleDismiss = (id: string) => {
    dismissContactsSyncConflict(id);
    refreshList();
    notify.info(t("contacts.sync.conflictDismissed"));
  };

  const handleRetryAll = async () => {
    setRetryingId("__all__");
    try {
      requeueAllContactsSyncConflicts();
      await flush();
      refreshList();
    } finally {
      setRetryingId(null);
    }
  };

  const rows = (() =>
    conflicts.map((entry) => {
      const { title } = describeContactsOutboxEntry(entry);
      return { entry, title };
    }))();

  return (
    <>
      <FormModal
        open={open}
        onClose={onClose}
        title={t("contacts.sync.conflictReviewTitle")}
        size="md"
        cancelLabel={t("common.close")}
        saveLabel={rows.length > 0 ? t("contacts.sync.conflictRetryAll") : t("common.close")}
        onSave={() => (rows.length > 0 ? void handleRetryAll() : onClose())}
        saving={retryingId != null}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("contacts.sync.conflictReviewDesc")}</p>
          {rows.length === 0 ? (
            <p className="text-sm text-foreground">{t("contacts.sync.conflictReviewEmpty")}</p>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {rows.map(({ entry, title }) => (
                <ContactsSyncConflictRow
                  key={entry.id}
                  entry={entry}
                  title={title}
                  onRequestDismiss={setDismissTargetId}
                  onResolved={refreshList}
                />
              ))}
            </ul>
          )}
          {rows.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-warning">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {t("contacts.sync.conflictReviewHint")}
            </div>
          )}
        </div>
      </FormModal>
      <ConfirmAlertDialog
        open={dismissTargetId != null}
        onOpenChange={(next) => !next && setDismissTargetId(null)}
        title={t("contacts.sync.conflictDismissConfirmTitle")}
        description={t("contacts.sync.conflictDismissConfirmDesc")}
        confirmLabel={t("contacts.sync.conflictDismissOne")}
        onConfirm={() => {
          if (dismissTargetId) handleDismiss(dismissTargetId);
          setDismissTargetId(null);
        }}
        destructive
      />
    </>
  );
}

export default ContactsSyncConflictPanel;

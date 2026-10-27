import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { ContactsSyncConflict } from "@/lib/contacts/contactsSyncOutbox";
import {
  describeContactsOutboxEntry,
  dismissContactsSyncConflict,
  getContactsSyncConflicts,
  requeueAllContactsSyncConflicts,
} from "@/lib/contacts/contactsSyncOutbox";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactsSyncOutbox } from "@/tenant/features/contacts/hooks/useContactsSyncOutbox";
import { Modal } from "@/components/app/Modal";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    if (open) {
      setConflicts(getContactsSyncConflicts());
    }
  }, [open]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [dismissTargetId, setDismissTargetId] = useState<string | null>(null);

  const refreshList = useCallback(() => {
    setConflicts(getContactsSyncConflicts());
    refreshCounts();
  }, [refreshCounts]);

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
      <Modal
        open={open}
        onClose={onClose}
        title={t("contacts.sync.conflictReviewTitle")}
        icon={AlertTriangle}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="min-h-11 px-4 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {t("common.close")}
            </Button>
            {rows.length > 0 && (
              <Button
                type="button"
                onClick={() => void handleRetryAll()}
                disabled={retryingId != null}
                className="min-h-11 px-4 text-sm font-semibold gap-2"
              >
                {retryingId != null && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("contacts.sync.conflictRetryAll")}
              </Button>
            )}
          </div>
        }
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
      </Modal>
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

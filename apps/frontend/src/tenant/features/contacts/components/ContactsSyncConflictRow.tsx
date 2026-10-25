import type React from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { formatDateTime } from "@mms/shared";
import type { ContactsSyncConflict } from "@/lib/contacts/contactsSyncOutbox";
import { getSyncConflictKindLabel } from "@/lib/contacts/contactI18n";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/app/Alert";
import { ContactsSyncConflictDiffBody } from "@/tenant/features/contacts/components/ContactsSyncConflictDiffBody";
import { useContactsSyncConflictRow } from "@/tenant/features/contacts/hooks/useContactsSyncConflictRow";

export interface ContactsSyncConflictRowProps {
  entry: ContactsSyncConflict;
  title: string;
  onRequestDismiss: (id: string) => void;
  onResolved: () => void;
}

export function ContactsSyncConflictRow({
  entry,
  title,
  onRequestDismiss,
  onResolved,
}: ContactsSyncConflictRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
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
  } = useContactsSyncConflictRow({ entry, onResolved });

  return (
    <li>
      <Alert
        density="compact"
        className="items-start overflow-hidden"
        title={title}
        description={`${getSyncConflictKindLabel(entry.kind, t)} · ${formatDateTime(entry.failedAt)}`}
        action={
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setExpanded((value) => !value)}
              className="min-h-11 min-w-11 text-muted-foreground hover:text-foreground hover:bg-muted/60"
              aria-expanded={expanded}
              aria-label={
                expanded ? t("contacts.sync.conflictCollapse") : t("contacts.sync.conflictExpand")
              }
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRequestDismiss(entry.id)}
              className="min-h-11 min-w-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              aria-label={t("contacts.sync.conflictDismissOne")}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        }
      >
        {expanded ? (
          <ContactsSyncConflictDiffBody
            local={local}
            serverContact={serverContact}
            serverLoading={serverLoading}
            diffs={diffs}
            fieldPicks={fieldPicks}
            applying={applying}
            onTogglePick={togglePick}
            onApplyMerge={() => void handleApplyMerge()}
            onKeepMine={() => void handleKeepMine()}
            onUseServer={handleUseServer}
            t={t}
          />
        ) : null}
      </Alert>
    </li>
  );
}

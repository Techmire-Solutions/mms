import type { JSX } from "react";
import { Printer } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EntityMessagingActions } from "@/components/ui/EntityMessagingActions";
import { ModuleRowActionsMenu } from "@/components/ui/ModuleRowActionsMenu";
import { useTranslation } from "@/hooks/useTranslation";
import type { ObligationCollection } from "@/lib/data/obligationsData";

interface ObligationCollectionRowActionsProps {
  collection: ObligationCollection;
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  /** When true, omit View (card already exposes a View control). */
  hideViewItem?: boolean;
  onView: (collection: ObligationCollection) => void;
  onPrint: (collection: ObligationCollection) => void;
  onMessage?: (channel: "sms" | "whatsapp" | "email", collections: ObligationCollection[]) => void;
  onTrashAction: (id: string) => void;
  triggerClassName?: string;
}

/**
 * Obligations collection row/card actions — thin adapter over the shared
 * {@link ModuleRowActionsMenu}; Print + WhatsApp/SMS are injected as module
 * extras, and Archive / Restore route to the parent's trash action (confirm
 * dialog owned by the list, not native confirm()).
 */
export function ObligationCollectionRowActions({
  collection,
  canWrite,
  canDelete,
  showDeleted,
  hideViewItem = false,
  onView,
  onPrint,
  onMessage,
  onTrashAction,
  triggerClassName,
}: ObligationCollectionRowActionsProps): JSX.Element {
  const { t } = useTranslation();
  const showMessaging = Boolean(onMessage) && !showDeleted;
  const showPrint = !showDeleted;

  return (
    <ModuleRowActionsMenu
      triggerLabel={t("obligations.table.actions")}
      viewLabel={t("obligations.actions.viewShort")}
      deleteLabel={t("common.delete")}
      restoreLabel={t("obligations.trash.restore")}
      archived={showDeleted}
      canWrite={canWrite}
      canDelete={canDelete}
      onView={() => onView(collection)}
      onEdit={undefined}
      onDelete={() => onTrashAction(collection.id)}
      onRestore={showDeleted ? () => onTrashAction(collection.id) : undefined}
      hideViewItem={hideViewItem}
      triggerClassName={triggerClassName}
      extras={
        showPrint || showMessaging ? (
          <>
            {showPrint ? (
              <DropdownMenuItem onClick={() => onPrint(collection)}>
                <Printer className="w-3.5 h-3.5 me-2" /> {t("obligations.actions.printShort")}
              </DropdownMenuItem>
            ) : null}
            {showMessaging && onMessage ? (
              <EntityMessagingActions
                variant="dropdown"
                showWhatsApp
                showSms
                showEmail={false}
                onWhatsApp={() => onMessage("whatsapp", [collection])}
                onSms={() => onMessage("sms", [collection])}
                onEmail={() => undefined}
                labels={{
                  whatsapp: t("obligations.list.actionWhatsApp"),
                  sms: t("obligations.list.actionSms"),
                  email: t("messaging.channel.email"),
                }}
              />
            ) : null}
          </>
        ) : undefined
      }
    />
  );
}

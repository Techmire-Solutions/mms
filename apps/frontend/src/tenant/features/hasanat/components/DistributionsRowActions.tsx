import type { JSX } from "react";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EntityMessagingActions } from "@/components/ui/EntityMessagingActions";
import { ModuleRowActionsMenu } from "@/components/ui/ModuleRowActionsMenu";
import { useTranslation } from "@/hooks/useTranslation";
import type { Distribution } from "@/lib/data/hasanatData";

type DistributionStatus = Distribution["status"];

interface DistributionsRowActionsProps {
  distribution: Distribution;
  statuses: DistributionStatus[];
  statusLabels: Record<DistributionStatus, string>;
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  canRestoreRows: boolean;
  canDeleteRows: boolean;
  triggerClassName?: string;
  onMessage?: (channel: "whatsapp" | "sms", distribution: Distribution) => void;
  onChangeStatus: (id: string, status: DistributionStatus) => void;
  onTrashAction: (id: string) => void;
}

/**
 * Hasanat distribution row/card actions — thin adapter over the shared
 * {@link ModuleRowActionsMenu}; distributions have no edit/detail surface, so the
 * menu carries the module-specific Change Status radio group + WhatsApp/SMS
 * messaging extras, with Archive / Restore routing to the trash action.
 */
export function DistributionsRowActions({
  distribution,
  statuses,
  statusLabels,
  canWrite,
  canDelete,
  showDeleted,
  canRestoreRows,
  canDeleteRows,
  triggerClassName,
  onMessage,
  onChangeStatus,
  onTrashAction,
}: DistributionsRowActionsProps): JSX.Element {
  const { t } = useTranslation();

  const showStatus = canWrite && !showDeleted && statuses.length > 0;
  const showMessaging = Boolean(onMessage) && !showDeleted;
  const showExtras = showStatus || showMessaging;

  return (
    <ModuleRowActionsMenu
      triggerLabel={t("hasanat.table.actions")}
      deleteLabel={t("common.delete")}
      restoreLabel={t("hasanat.trash.restore")}
      archived={showDeleted}
      canWrite={canWrite}
      canDelete={canDelete && (showDeleted ? canRestoreRows : canDeleteRows)}
      onView={undefined}
      onEdit={undefined}
      onDelete={() => onTrashAction(distribution.id)}
      onRestore={showDeleted ? () => onTrashAction(distribution.id) : undefined}
      hideViewItem
      triggerClassName={triggerClassName}
      extras={
        showExtras ? (
          <>
            {showStatus ? (
              <>
                <DropdownMenuLabel className="text-xs">
                  {t("hasanat.changeStatus")}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={distribution.status}
                  onValueChange={(status) =>
                    onChangeStatus(distribution.id, status as DistributionStatus)
                  }
                >
                  {statuses.map((status) => (
                    <DropdownMenuRadioItem key={status} value={status}>
                      {statusLabels[status]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            ) : null}
            {showMessaging && onMessage ? (
              <>
                {showStatus ? <DropdownMenuSeparator /> : null}
                <DropdownMenuLabel className="text-xs">{t("messaging.channel")}</DropdownMenuLabel>
                <EntityMessagingActions
                  variant="dropdown"
                  showWhatsApp
                  showSms
                  showEmail={false}
                  onWhatsApp={() => onMessage("whatsapp", distribution)}
                  onSms={() => onMessage("sms", distribution)}
                  onEmail={() => undefined}
                  labels={{
                    whatsapp: t("messaging.channel.whatsapp"),
                    sms: t("messaging.channel.sms"),
                    email: t("messaging.channel.email"),
                  }}
                />
              </>
            ) : null}
          </>
        ) : undefined
      }
    />
  );
}

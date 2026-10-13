import type React from "react";
import { ReceiptText } from "lucide-react";
import type { StandardMessagingRecipient } from "@mms/shared";
import { getOutstandingAmountForInvoice } from "@mms/shared";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ModuleRowActionsMenu } from "@/components/app/ModuleRowActionsMenu";
import { PersonMessagingRowActionsExtras } from "@/components/app/PersonMessagingRowActionsExtras";
import { useTranslation } from "@/hooks/useTranslation";
import type { Invoice } from "@/lib/data/financeData";

export type InvoiceMessageChannel = "sms" | "whatsapp" | "email";

export interface InvoicesRowActionsProps {
  invoice: Invoice;
  canWrite: boolean;
  canDelete: boolean;
  canWriteMessaging: boolean;
  showDeleted: boolean;
  /** When true, omit View (card already exposes a View control). */
  hideViewItem?: boolean;
  onView: (invoice: Invoice) => void;
  onRecord: (invoice: Invoice) => void;
  onRequestDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  openComposer: (channel: InvoiceMessageChannel, recipients: StandardMessagingRecipient[]) => void;
  triggerClassName?: string;
}

/**
 * Finance invoice row/card actions — thin adapter over the shared
 * {@link ModuleRowActionsMenu}; Record payment is injected as a module extras
 * item and messaging items come from {@link PersonMessagingRowActionsExtras}.
 */
export function InvoicesRowActions({
  invoice,
  canWrite,
  canDelete,
  canWriteMessaging,
  showDeleted,
  hideViewItem = false,
  onView,
  onRecord,
  onRequestDelete,
  onRestore,
  openComposer,
  triggerClassName,
}: InvoicesRowActionsProps): React.JSX.Element {
  const { t } = useTranslation();
  const rawPhone = Reflect.get(invoice, "phone");
  const rawEmail = Reflect.get(invoice, "email");
  const phone = typeof rawPhone === "string" ? rawPhone.trim() : "";
  const email = typeof rawEmail === "string" ? rawEmail : undefined;
  const recipient: StandardMessagingRecipient = {
    id: invoice.id,
    name: invoice.studentName,
    phone,
    email,
    amount: getOutstandingAmountForInvoice(invoice),
    dueDate: invoice.dueDate,
  };

  const openChannel = (channel: InvoiceMessageChannel) => openComposer(channel, [recipient]);

  return (
    <ModuleRowActionsMenu
      triggerLabel={t("finance.table.actions")}
      viewLabel={t("finance.table.viewProfile")}
      deleteLabel={t("common.delete")}
      restoreLabel={t("finance.trash.restore")}
      archived={showDeleted}
      canWrite={canWrite}
      canDelete={canDelete}
      onView={onView ? () => onView(invoice) : undefined}
      onEdit={undefined}
      onDelete={() => onRequestDelete?.(invoice.id)}
      onRestore={onRestore ? () => onRestore(invoice.id) : undefined}
      hideViewItem={hideViewItem}
      triggerClassName={triggerClassName}
      extras={
        <>
          {!showDeleted &&
          canWrite &&
          invoice.status !== "paid" &&
          invoice.status !== "cancelled" ? (
            <DropdownMenuItem onClick={() => onRecord(invoice)}>
              <ReceiptText className="w-3.5 h-3.5 me-2" />{" "}
              {t("finance.recordPaymentFor", { id: invoice.id })}
            </DropdownMenuItem>
          ) : null}
          <PersonMessagingRowActionsExtras
            phone={phone || null}
            email={email ?? null}
            hasWhatsApp={Boolean(phone)}
            hideMessagingItems={showDeleted || !canWriteMessaging}
            onWhatsApp={() => openChannel("whatsapp")}
            onSms={() => openChannel("sms")}
            onEmail={() => openChannel("email")}
            labels={{
              whatsapp: t("messaging.sendWhatsapp"),
              sms: t("messaging.sendSms"),
              email: t("messaging.sendEmail"),
            }}
          />
        </>
      }
    />
  );
}

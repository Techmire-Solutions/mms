import React from "react";
import { type Contact, getPrimaryEmail, getPrimaryPhone, hasWhatsApp } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { ModuleRowActionsMenu } from "@/components/app/ModuleRowActionsMenu";
import { PersonMessagingRowActionsExtras } from "@/components/app/PersonMessagingRowActionsExtras";

export interface ContactsRowActionsProps {
  contact: Contact;
  onView?: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string | number) => void;
  onRestore?: (id: string | number) => void;
  /** Omit when messaging is forbidden (RBAC) or archive mode. */
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
  showArchived?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
  triggerClassName?: string;
  /** When true, omit View (face header/footer already opens the profile). */
  hideViewItem?: boolean;
  /** When true, omit messaging items (face icon strip already covers channels). */
  hideMessagingItems?: boolean;
}

/**
 * Contacts row/card actions — thin adapter over the shared
 * {@link ModuleRowActionsMenu}; messaging items are injected as module extras
 * and omitted (not disabled) when handlers are undefined or the channel is unavailable.
 */
export const ContactsRowActions = React.memo(function ContactsRowActions({
  contact,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onWhatsApp,
  onSms,
  onEmail,
  showArchived = false,
  canWrite = false,
  canDelete = false,
  triggerClassName,
  hideViewItem = false,
  hideMessagingItems = false,
}: ContactsRowActionsProps): React.JSX.Element {
  const { t } = useTranslation();
  const primaryEmail = getPrimaryEmail(contact);
  const primaryPhone = getPrimaryPhone(contact);

  return (
    <ModuleRowActionsMenu
      triggerLabel={t("contacts.table.actions")}
      viewLabel={t("contacts.table.viewProfile")}
      editLabel={t("contacts.table.edit")}
      deleteLabel={t("contacts.table.deleteContact")}
      restoreLabel={t("contacts.restoreContact")}
      archived={showArchived}
      canWrite={canWrite}
      canDelete={canDelete}
      onView={onView ? () => onView(contact) : undefined}
      onEdit={() => onEdit(contact)}
      onDelete={() => onDelete(contact.id)}
      onRestore={onRestore ? () => onRestore(contact.id) : undefined}
      hideViewItem={hideViewItem}
      triggerClassName={triggerClassName}
      extras={
        <PersonMessagingRowActionsExtras
          phone={primaryPhone}
          email={primaryEmail}
          hasWhatsApp={hasWhatsApp(contact)}
          hideMessagingItems={hideMessagingItems || showArchived}
          onWhatsApp={() => onWhatsApp?.([contact])}
          onSms={() => onSms?.([contact])}
          onEmail={() => onEmail?.([contact])}
          labels={{
            whatsapp: t("contacts.whatsapp"),
            sms: t("contacts.sms"),
            email: t("contacts.detail.emailAction"),
          }}
        />
      }
    />
  );
});

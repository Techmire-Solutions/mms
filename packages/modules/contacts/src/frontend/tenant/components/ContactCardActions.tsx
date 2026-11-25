import type { Contact } from "@mms/contracts";
import { ENTITY_CARD_OVERFLOW_TRIGGER_CLASS } from "@mms/ui/app/entityCardChrome";
import { DirectoryCardFooterActions } from "@mms/fe-core/components/DirectoryCardFooterActions";
import { ContactsRowActions } from "./ContactsRowActions.js";
import { useTranslation } from "@mms/fe-core/i18n";

export interface ContactCardActionsProps {
  contact: Contact;
  displayName: string;
  showArchived: boolean;
  canWrite: boolean;
  canDelete: boolean;
  onView?: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string | number) => void;
  onRestore?: (id: string | number) => void;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
}

/** Messaging + view/overflow actions for a contact directory card. */
export function ContactCardActions({
  contact,
  displayName,
  showArchived,
  canWrite,
  canDelete,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onWhatsApp,
  onSms,
  onEmail,
}: ContactCardActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <DirectoryCardFooterActions
      onView={onView ? () => onView(contact) : undefined}
      viewLabel={t("contacts.actionViewShort")}
      viewAriaLabel={`${t("contacts.table.viewProfile")} - ${displayName}`}
      overflowActions={
        <ContactsRowActions
          contact={contact}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onRestore={onRestore}
          onWhatsApp={onWhatsApp}
          onSms={onSms}
          onEmail={onEmail}
          showArchived={showArchived}
          canWrite={canWrite}
          canDelete={canDelete}
          hideViewItem={Boolean(onView)}
          triggerClassName={ENTITY_CARD_OVERFLOW_TRIGGER_CLASS}
        />
      }
    />
  );
}

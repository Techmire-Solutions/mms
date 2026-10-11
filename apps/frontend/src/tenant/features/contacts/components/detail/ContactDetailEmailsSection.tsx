import type { Contact } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveEmailLabel } from "@/lib/contacts/contactI18n";
import { CollectionRowItem } from "./ContactDetailShared";
import { DetailSectionCard } from "@/components/ui/DetailSectionCard";
import { COLLECTION_CONTAINER_CLASS } from "./contactDetailStyles";
import { DetailCollectionEmpty, withPrimaryEmail } from "./contactDetailChannelHelpers";
import { buildDetailEmailMessagingActions } from "./contactDetailMessagingActions";

export interface ContactDetailEmailsSectionProps {
  contact: Contact;
  emailLabels: string[];
  onEmail?: (contacts: Contact[]) => void;
}

export function ContactDetailEmailsSection({
  contact,
  emailLabels,
  onEmail,
}: ContactDetailEmailsSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const emails = contact.emails && contact.emails.length > 0 ? contact.emails : [];

  return (
    <DetailSectionCard
      className={COLLECTION_CONTAINER_CLASS}
      title={t("contacts.form.emailsLabel")}
    >
      {emails.length === 0 ? (
        <DetailCollectionEmpty title={t("contacts.detail.emptyEmails")} />
      ) : (
        emails.map((email, emailIndex) => {
          const rawEmail = String(email.address || "").trim();
          const actions =
            onEmail && rawEmail
              ? buildDetailEmailMessagingActions({
                  emailTitle: t("contacts.detail.emailContact", { email: rawEmail }),
                  onEmail: () =>
                    onEmail([withPrimaryEmail(contact, { ...email, address: rawEmail })]),
                })
              : [];

          return (
            <CollectionRowItem
              key={`email-${email.address}-${emailIndex}`}
              label={resolveEmailLabel(email.label, emailLabels, t)}
              value={rawEmail}
              actions={actions}
            />
          );
        })
      )}
    </DetailSectionCard>
  );
}

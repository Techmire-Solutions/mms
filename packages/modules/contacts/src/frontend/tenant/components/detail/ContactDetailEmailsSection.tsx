import type { Contact } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { resolveEmailLabel } from "@mms/fe-core/lib/contactI18n";
import { CollectionRowItem } from "./ContactDetailShared.js";
import { DetailSectionCard } from "@mms/fe-core/components/DetailSectionCard";
import { COLLECTION_CONTAINER_CLASS } from "./contactDetailStyles.js";
import { DetailCollectionEmpty, withPrimaryEmail } from "./contactDetailChannelHelpers.js";
import { buildDetailEmailMessagingActions } from "./contactDetailMessagingActions.js";

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
              dir="ltr"
              actions={actions}
            />
          );
        })
      )}
    </DetailSectionCard>
  );
}

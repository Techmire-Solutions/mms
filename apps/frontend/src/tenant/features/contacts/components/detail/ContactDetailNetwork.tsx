import React, { useMemo } from "react";
import { Users as UsersIcon } from "lucide-react";
import {
  getDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
  hasWhatsApp,
  mergeStoredAndDerivedSiblingLinks,
} from "@mms/shared";
import type { Contact } from "@mms/shared";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { formatLocalizedRelationshipLabel } from "@/lib/contacts/formatLocalizedRelationshipLabel";
import { DetailCollectionEmpty } from "./contactDetailChannelHelpers";
import { ContactNetworkLinkCard } from "./ContactNetworkLinkCard";
import { DETAIL_STYLES } from "./contactDetailStyles";

export interface ContactDetailNetworkProps {
  contact: Contact;
  allContacts: Contact[];
  onNavigateToContact: (targetId: string | number) => void;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
}

function resolveLinkedDisplayName(
  entry: { contactId: string; name?: string },
  target: Contact | undefined,
  unknownLabel: string,
): string {
  if (target) return getDisplayName(target);
  const legacyName = (entry.name || "").trim();
  if (legacyName) return legacyName;
  if (entry.contactId.trim().length > 0) return unknownLabel;
  return "";
}

export function ContactDetailNetwork({
  contact,
  allContacts,
  onNavigateToContact,
  onWhatsApp,
  onSms,
  onEmail,
}: ContactDetailNetworkProps): React.JSX.Element {
  const { t } = useTranslation();
  const links = useMemo(
    () => mergeStoredAndDerivedSiblingLinks(contact, allContacts),
    [contact, allContacts],
  );
  const contactsById = useMemo(
    () => new Map(allContacts.map((c) => [String(c.id), c])),
    [allContacts],
  );
  const parentAllowsOutbound = !contact.deletedAt;

  return (
    <div className="space-y-6">
      <div
        className={`p-4 rounded-2xl border flex items-center gap-3 ${DETAIL_STYLES.networkHeader}`}
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-xs ${DETAIL_STYLES.networkIcon}`}
        >
          <UsersIcon className="w-5 h-5" aria-hidden />
        </div>
        <div>
          <h4 className={`text-sm font-bold leading-none ${DETAIL_STYLES.networkTitle}`}>
            {links.length} {t("contacts.detail.relationships")}
          </h4>
          {links.length > 0 ? (
            <p
              className={`text-xs font-medium mt-1 uppercase tracking-tight ${DETAIL_STYLES.networkSubtitle}`}
            >
              {t("contacts.detail.activeSocialGraph")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {links.length === 0 ? (
          <DetailCollectionEmpty
            title={t("contacts.detail.emptyRelationships")}
            variant="bordered"
          />
        ) : (
          <Card className="divide-y divide-border/50 p-0">
            {links.map((relationship, relationshipIndex) => {
              const target = relationship.contactId
                ? contactsById.get(relationship.contactId)
                : undefined;
              const displayName = resolveLinkedDisplayName(
                relationship,
                target,
                t("contacts.detail.unknownContact"),
              );
              const relationshipLabel =
                formatLocalizedRelationshipLabel(
                  relationship.relationship,
                  target?.gender ?? relationship.gender,
                  t,
                ) || t("contacts.detail.linkedContact");
              const linkedId = target?.id ?? (relationship.contactId || undefined);
              const canNavigate = linkedId != null && String(linkedId).length > 0;
              const allowOutbound = parentAllowsOutbound && !target?.deletedAt;
              const targetPhone = target ? getPrimaryPhone(target) : null;
              const targetEmail = target ? getPrimaryEmail(target) : null;
              const legacyPhone = relationship.phone?.trim() || "";
              const showTargetMessaging =
                Boolean(target) &&
                allowOutbound &&
                (Boolean(targetPhone) ||
                  Boolean(targetEmail && onEmail) ||
                  (Boolean(onWhatsApp) && target != null && hasWhatsApp(target)) ||
                  (Boolean(onSms) && Boolean(targetPhone)));
              const showLegacyCall = allowOutbound && !target && Boolean(legacyPhone);

              return (
                <ContactNetworkLinkCard
                  key={relationship.contactId || relationship.name || `link-${relationshipIndex}`}
                  displayName={displayName}
                  relationshipLabel={relationshipLabel}
                  avatarId={
                    target?.id ?? (relationship.contactId || relationship.name || relationshipIndex)
                  }
                  avatar={target?.avatar}
                  target={target}
                  targetPhone={targetPhone}
                  targetEmail={targetEmail}
                  legacyPhone={legacyPhone}
                  showTargetMessaging={showTargetMessaging}
                  showLegacyCall={showLegacyCall}
                  canNavigate={canNavigate}
                  linkedId={linkedId}
                  onNavigateToContact={onNavigateToContact}
                  onWhatsApp={onWhatsApp}
                  onSms={onSms}
                  onEmail={onEmail}
                />
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

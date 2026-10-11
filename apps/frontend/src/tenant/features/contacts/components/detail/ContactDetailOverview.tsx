import React, { useMemo } from "react";
import { isContactRelationshipTabEnabled, type Contact } from "@mms/shared";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { FieldGroupCard } from "./ContactDetailShared";
import { ContactDetailCollections } from "./ContactDetailCollections";
import { ContactDetailNetwork } from "./ContactDetailNetwork";
import { ContactDetailHeroCard } from "./ContactDetailHeroCard";
import { ContactDetailOverviewQuickActions } from "./ContactDetailOverviewQuickActions";

const ACCENT_COLORS = [
  "info",
  "warning",
  "success",
  "primary",
  "secondary",
  "purple",
  "amber",
  "rose",
  "teal",
  "indigo",
  "pink",
] as const;

export interface ContactDetailOverviewField {
  key: string;
  label: string;
  type: string;
  tab: string;
  group: string;
  description: string;
}

export interface ContactDetailOverviewProps {
  contact: Contact;
  allContacts: Contact[];
  grouped: Record<string, ContactDetailOverviewField[]>;
  formatFieldValue: (field: { key: string; type: string }) => string | null;
  visibleCollectionFields: {
    phones: { enabled?: boolean }[];
    emails: { enabled?: boolean }[];
    addresses: { enabled?: boolean }[];
    socials: { enabled?: boolean }[];
    education: { enabled?: boolean }[];
    experience: { enabled?: boolean }[];
    skills: { enabled?: boolean }[];
    bankDetails?: { enabled?: boolean }[];
    relationship: { enabled?: boolean }[];
  };
  primaryPhone: string | null;
  primaryEmail: string | null;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
  onNavigateToContact: (targetId: string | number) => void;
}

export function ContactDetailOverview({
  contact,
  allContacts,
  grouped,
  formatFieldValue,
  visibleCollectionFields,
  primaryPhone,
  primaryEmail,
  onWhatsApp,
  onSms,
  onEmail,
  onNavigateToContact,
}: ContactDetailOverviewProps): React.JSX.Element {
  const { enabledTabIds } = useContactConfig();
  const showRelationships =
    isContactRelationshipTabEnabled(enabledTabIds) &&
    visibleCollectionFields.relationship.length > 0;
  const showPhoneSection = enabledTabIds.has("phones") && visibleCollectionFields.phones.length > 0;
  const showEmailSection = enabledTabIds.has("emails") && visibleCollectionFields.emails.length > 0;
  // Per-row channel actions cover Call/WA/SMS/Email when those sections render.
  const showQuickActions = !showPhoneSection && !showEmailSection;
  const basicGroups = useMemo(
    () =>
      Object.entries(grouped)
        .map(([groupName, fieldsList]) => ({
          groupName,
          fields: fieldsList,
        }))
        .filter((entry) => entry.fields.length > 0),
    [grouped],
  );

  return (
    <>
      <ContactDetailHeroCard contact={contact} />

      {showQuickActions ? (
        <ContactDetailOverviewQuickActions
          contact={contact}
          primaryPhone={primaryPhone}
          primaryEmail={primaryEmail}
          onWhatsApp={onWhatsApp}
          onSms={onSms}
          onEmail={onEmail}
        />
      ) : null}

      <div className="space-y-4">
        {basicGroups.map(({ groupName, fields }, index) => (
          <FieldGroupCard
            key={groupName}
            group={groupName}
            fields={fields}
            formatValue={formatFieldValue}
            getRawValue={(key) => (contact as Record<string, unknown>)[key]}
            accentColor={ACCENT_COLORS[index % ACCENT_COLORS.length]}
          />
        ))}

        <ContactDetailCollections
          contact={contact}
          visibleCollectionFields={visibleCollectionFields}
          onWhatsApp={onWhatsApp}
          onSms={onSms}
          onEmail={onEmail}
        />

        {showRelationships ? (
          <ContactDetailNetwork
            contact={contact}
            allContacts={allContacts}
            onNavigateToContact={onNavigateToContact}
            onWhatsApp={onWhatsApp}
            onSms={onSms}
            onEmail={onEmail}
          />
        ) : null}
      </div>
    </>
  );
}

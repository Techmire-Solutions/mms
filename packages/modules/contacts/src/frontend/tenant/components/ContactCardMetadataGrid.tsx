import type React from "react";
import {
  isRelationshipContactColumnKey,
  isRelationshipTypeColumnKey,
  isRelationshipWorkColumnKey,
  type Contact,
  type ContactPreferences,
} from "@mms/contracts";
import { DirectoryCardMetadata } from "@mms/fe-core/components/DirectoryCardMetadata";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import { ContactArchivedBanner } from "./ContactArchivedBanner.js";
import { ContactMetadataCell } from "./ContactMetadataCell.js";
import { hasContactCardColumnData } from "../lib/contactCardColumnData";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import type { ContactsColumnConfig } from "../lib/contactTableTypes";

export interface ContactCardMetadataGridProps {
  contact: Contact;
  prefs: ContactPreferences;
  allContacts: Contact[];
  contactsMap: Map<string, Contact> | null;
  otherColumns: ContactsColumnConfig[];
  isColumnVisible: (key: string) => boolean;
  t: TranslationFunction;
  descriptor?: EntityDescriptor<Contact>;
  entity?: Contact;
}

export function ContactCardMetadataGrid({
  contact,
  prefs,
  allContacts,
  contactsMap,
  otherColumns,
  isColumnVisible,
  t,
  descriptor,
  entity,
}: ContactCardMetadataGridProps): React.JSX.Element | null {
  if (otherColumns.length === 0 && !descriptor) {
    return null;
  }

  const hasVisibleRelationshipContact = otherColumns.some(
    (col) => isRelationshipContactColumnKey(col.id) && isColumnVisible(col.id),
  );

  const extraColumns =
    otherColumns.length > 0
      ? {
          columns: otherColumns,
          keyFor: (col: ContactsColumnConfig) => col.id,
          labelFor: (col: ContactsColumnConfig) =>
            col.id === "socials_platform" || col.id === "socials_url"
              ? t("contacts.detail.socials")
              : isRelationshipWorkColumnKey(col.id)
                ? t("contacts.form.tabRelationship")
                : col.label,
          renderValue: (col: ContactsColumnConfig) => {
            if (col.id === "socials_url" && isColumnVisible("socials_platform")) {
              return null;
            }
            if (isRelationshipTypeColumnKey(col.id) && hasVisibleRelationshipContact) {
              return null;
            }
            if (!hasContactCardColumnData(contact, col.id)) return null;

            return (
              <ContactMetadataCell
                colId={col.id}
                contact={contact}
                prefs={prefs}
                allContacts={allContacts}
                contactsMap={contactsMap}
                variant="card"
              />
            );
          },
        }
      : undefined;

  return (
    <DirectoryCardMetadata
      descriptor={descriptor}
      entity={entity ?? contact}
      isColumnVisible={isColumnVisible}
      extraColumns={extraColumns}
      columns={extraColumns?.columns}
      keyFor={extraColumns?.keyFor}
      labelFor={extraColumns?.labelFor}
      renderValue={extraColumns?.renderValue}
    />
  );
}

export interface ContactCardDeletedBannerProps {
  contact: Contact;
}

export function ContactCardDeletedBanner({
  contact,
}: ContactCardDeletedBannerProps): React.JSX.Element | null {
  return <ContactArchivedBanner contact={contact} />;
}

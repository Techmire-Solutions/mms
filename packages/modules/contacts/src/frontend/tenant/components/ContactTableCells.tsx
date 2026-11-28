import { type Contact, type ContactPreferences } from "@mms/contracts";
import { ContactMetadataCell } from "./ContactMetadataCell.js";
import type { useTranslation } from "@mms/fe-core/i18n";
import { columnWidthStyle, type ContactsColumnConfig } from "../lib/contactTableTypes";
import {
  renderContactEmailCell,
  renderContactNameCell,
  renderContactPhoneCell,
} from "./contactTablePrimaryCells.js";

type Translate = ReturnType<typeof useTranslation>["t"];

export interface RenderContactTableCellParams {
  col: ContactsColumnConfig;
  contact: Contact;
  displayName: string;
  getColumnWidth: (key: string) => number | undefined;
  prefs: ContactPreferences;
  countryCodesMap: Record<string, string>;
  countryCodes: Array<{ country: string; code: string }>;
  contactsMap: Map<string, Contact> | null;
  allContacts: Contact[];
  showArchived: boolean;
  isSelected: boolean;
  t: Translate;
  onView?: (contact: Contact) => void;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  rowIndex?: number;
}

export function renderContactTableCell({
  col,
  contact,
  displayName,
  getColumnWidth,
  prefs,
  countryCodesMap,
  countryCodes,
  contactsMap,
  allContacts,
  showArchived,
  isSelected,
  t,
  onView,
  onWhatsApp,
  onSms,
  rowIndex,
}: RenderContactTableCellParams): React.JSX.Element {
  const width = getColumnWidth(col.id) ?? col.width;
  const widthStyle = columnWidthStyle(width);

  switch (col.id) {
    case "name":
      return renderContactNameCell({
        contact,
        displayName,
        widthStyle,
        showArchived,
        isSelected,
        t,
        onView,
        rowIndex,
      });
    case "phone":
      return renderContactPhoneCell({
        contact,
        prefs,
        countryCodesMap,
        countryCodes,
        widthStyle,
        showArchived,
        t,
        onWhatsApp,
        onSms,
      });
    case "email":
      return renderContactEmailCell({ contact, widthStyle, showArchived, t });
    default:
      return (
        <ContactMetadataCell
          key={col.id}
          colId={col.id}
          contact={contact}
          prefs={prefs}
          allContacts={allContacts}
          contactsMap={contactsMap}
          variant="card"
          style={widthStyle}
        />
      );
  }
}

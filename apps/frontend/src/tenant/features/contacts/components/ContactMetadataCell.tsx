import React from "react";
import type { Contact, ContactPreferences } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { TableCell } from "@/components/ui/table";
import { buildContactsMap } from "@/lib/contacts/contactI18n";
import { renderContactMetadataCellValue } from "@/tenant/features/contacts/components/contactMetadataCellRenderer";

export interface ContactMetadataCellProps {
  colId: string;
  contact: Contact;
  prefs: Pick<ContactPreferences, "showDetailedSolarAge" | "showLunarDob" | "showDetailedLunarAge">;
  allContacts?: Contact[];
  contactsMap?: Map<string, Contact> | null;
  variant?: "table" | "card";
  style?: React.CSSProperties;
}

/**
 * DRY component for rendering contact table cells and card metadata attributes
 * based on column key and user field preferences (globle1 §3.3).
 */
export function ContactMetadataCell({
  colId,
  contact,
  prefs,
  allContacts = [],
  contactsMap: externalContactsMap,
  variant = "table",
  style,
}: ContactMetadataCellProps): React.JSX.Element {
  const { t, language } = useTranslation();

  const contactsMap = (() => {
    if (externalContactsMap !== undefined) return externalContactsMap;
    return buildContactsMap(allContacts);
  })();

  const renderDash = (): React.ReactNode => (
    <span className="text-muted-foreground">{t("contacts.table.emptyDash")}</span>
  );

  const renderJoinedList = (
    items: (string | undefined | null)[],
    showTitle = false,
  ): React.ReactNode => {
    const valid = items.filter(Boolean) as string[];
    if (valid.length === 0) return renderDash();
    const joined = valid.join(", ");
    return (
      <span className="truncate" title={showTitle ? joined : undefined}>
        {joined}
      </span>
    );
  };

  const cellContent = renderContactMetadataCellValue({
    colId,
    contact,
    prefs,
    contactsMap,
    t,
    language,
    renderDash,
    renderJoinedList,
  });

  if (variant === "table") {
    return (
      <TableCell className="px-4 py-3" style={style}>
        {cellContent}
      </TableCell>
    );
  }

  return <>{cellContent}</>;
}

import React, { useMemo } from "react";
import type { Contact, ContactPreferences } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { TableCell } from "@mms/ui";
import { BiDiText } from "@mms/ui/app/BiDiText";
import { buildContactsMap } from "@mms/fe-core/lib/contactI18n";
import { renderContactMetadataCellValue } from "./contactMetadataCellRenderer.js";

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

  // Production callers pass the page-level map; the fallback is memoised so a
  // caller that forgets cannot rebuild a directory-sized map on every render.
  const contactsMap = useMemo(
    () => (externalContactsMap !== undefined ? externalContactsMap : buildContactsMap(allContacts)),
    [externalContactsMap, allContacts],
  );

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
      <BiDiText as="span" className="truncate" titleFromContent={showTitle}>
        {joined}
      </BiDiText>
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

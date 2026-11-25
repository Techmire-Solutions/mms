import type { Contact } from "@mms/contracts";
import { ContactIdentityMeta } from "./ContactIdentityMeta.js";
import { useTranslation } from "@mms/fe-core/i18n";
import { EntityCard } from "@mms/fe-core/components/EntityCard";

export interface ContactCardHeaderProps {
  contact: Contact;
  isSelected: boolean;
  displayName: string;
  onSelect: (id: string | number) => void;
  onView?: (contact: Contact) => void;
  isColumnVisible?: (key: string) => boolean;
  reducedMotion?: boolean;
}

export function ContactCardHeader({
  contact,
  isSelected,
  displayName,
  onSelect,
  onView,
  isColumnVisible,
  reducedMotion = false,
}: ContactCardHeaderProps): React.JSX.Element {
  const { t } = useTranslation();

  const showGender = !isColumnVisible || isColumnVisible("gender");
  const showSyed = !isColumnVisible || isColumnVisible("isSyed") || isColumnVisible("syed");

  const effectiveGender = showGender ? contact.gender : undefined;
  const effectiveSyed = showSyed ? contact.isSyed : undefined;

  const hasSubtitle = Boolean(effectiveGender || effectiveSyed);
  const subtitle = hasSubtitle ? (
    <ContactIdentityMeta
      gender={effectiveGender}
      isSyed={effectiveSyed}
      className="mt-0.5 font-semibold truncate"
    />
  ) : undefined;

  return (
    <EntityCard.Header
      id={contact.id}
      displayName={displayName}
      avatar={contact.avatar}
      gender={effectiveGender}
      isSelected={isSelected}
      onSelect={() => onSelect(contact.id)}
      selectAriaLabel={t("contacts.table.selectContact", { name: displayName })}
      onView={() => onView?.(contact)}
      viewAriaLabel={`${t("contacts.table.viewProfile")} - ${displayName}`}
      reducedMotion={reducedMotion}
      subtitle={subtitle}
    />
  );
}

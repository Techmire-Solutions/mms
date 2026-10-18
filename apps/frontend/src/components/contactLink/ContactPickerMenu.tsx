import React from "react";
import { createPortal } from "react-dom";
import { User } from "lucide-react";
import { type Contact, getDisplayName, getPrimaryPhone, getPrimaryAddress } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { UserAvatar } from "@/components/app/UserAvatar";

export interface ContactPickerMenuProps {
  open: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  resolvedId: string;
  label: string;
  menuStyle: React.CSSProperties;
  matches: Contact[];
  isSearching: boolean;
  emptyTitle: string;
  emptyHint: string;
  onSelect: (contact: Contact) => void;
}

export function ContactPickerMenu({
  open,
  menuRef,
  resolvedId,
  label,
  menuStyle,
  matches,
  isSearching,
  emptyTitle,
  emptyHint,
  onSelect,
}: ContactPickerMenuProps): React.ReactPortal | null {
  const { t } = useTranslation();
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      id={`${resolvedId}-listbox`}
      style={menuStyle}
      className="overflow-y-auto rounded-xl surface-overlay divide-y divide-border/60 z-toast"
      role="listbox"
      aria-label={label}
    >
      {isSearching && matches.length === 0 && (
        <div className="px-4.5 py-3 text-xs text-muted-foreground text-center">
          {t("common.loading")}
        </div>
      )}
      {matches.length === 0 && !isSearching && (
        <EmptyState
          title={emptyTitle}
          description={emptyHint}
          icon={User}
          compact
          className="bg-muted/5"
        />
      )}
      {matches.map((contact) => {
        const contactPhone = getPrimaryPhone(contact);
        const primaryAddr = getPrimaryAddress(contact);
        const contactCity = primaryAddr?.city;
        const contactName = getDisplayName(contact);

        return (
          <Button
            key={contact.id}
            type="button"
            variant="ghost"
            role="option"
            aria-selected={false}
            onPointerDown={(e) => {
              e.preventDefault();
              onSelect(contact);
            }}
            onClick={() => {
              onSelect(contact);
            }}
            className="w-full flex items-center h-auto font-normal justify-start gap-3 px-3.5 py-2.5 hover:bg-muted transition-colors text-start focus:outline-none rounded-none shadow-none text-foreground"
          >
            <UserAvatar
              id={contact.id}
              name={contactName}
              avatar={contact.avatar}
              gender={contact.gender}
              className="w-8 h-8 text-xs flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate" title={contactName}>
                {contactName}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate mt-0.5">
                {contactPhone || t("contacts.table.emptyDash")}
                {contactCity && <span>· {contactCity}</span>}
              </p>
            </div>
          </Button>
        );
      })}
    </div>,
    document.body,
  );
}

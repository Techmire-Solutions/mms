import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { type Contact, type ContactPreferences, getDisplayName } from "@mms/shared";
import { resolveAllContactPhones, resolveAllContactEmails } from "@/lib/contacts/contactI18n";
import { ContactIdentityMeta } from "@/tenant/features/contacts/components/ContactIdentityMeta";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ContactPhoneAction, ContactEmailAction } from "@/components/ui/ContactAction";

import type { useTranslation } from "@/hooks/useTranslation";

export type ContactCellTranslate = ReturnType<typeof useTranslation>["t"];

export interface RenderContactNameCellParams {
  contact: Contact;
  displayName: string;
  widthStyle: CSSProperties | undefined;
  showArchived: boolean;
  isSelected: boolean;
  t: ContactCellTranslate;
  onView?: (contact: Contact) => void;
}

export function renderContactNameCell({
  contact,
  displayName,
  showArchived,
  isSelected: _isSelected,
  t,
  onView,
}: RenderContactNameCellParams): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar
        id={contact.id}
        name={displayName}
        avatar={contact.avatar}
        gender={contact.gender}
        size="md"
        className="shrink-0"
      />
      <div className="min-w-0">
        <Button
          onClick={() => onView?.(contact)}
          variant="ghost"
          className="min-h-11 h-auto max-w-full p-0 text-sm font-semibold text-foreground hover:text-primary transition-colors text-start justify-start hover:bg-transparent"
          type="button"
          title={displayName}
        >
          <span className="block truncate">{displayName}</span>
        </Button>
        <ContactIdentityMeta gender={contact.gender} isSyed={contact.isSyed} className="mt-0.5" />
        {showArchived && contact.deletionReason && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 break-words">
            {t("contacts.deletionReasonLabel")}: {contact.deletionReason}
          </p>
        )}
      </div>
    </div>
  );
}

export interface RenderContactPhoneCellParams {
  contact: Contact;
  prefs: ContactPreferences;
  countryCodesMap: Record<string, string>;
  countryCodes: Array<{ country: string; code: string }>;
  widthStyle: CSSProperties | undefined;
  t: ContactCellTranslate;
  onWhatsApp?: (contacts: Contact[]) => void;
}

export function renderContactPhoneCell({
  contact,
  prefs,
  countryCodesMap,
  countryCodes,
  widthStyle: _widthStyle,
  t,
  onWhatsApp,
}: RenderContactPhoneCellParams): React.JSX.Element {
  const allPhones = resolveAllContactPhones(contact, prefs, countryCodesMap, countryCodes);
  const displayName = getDisplayName(contact) || "";
  const emptyDash = (
    <span className="text-sm text-muted-foreground">{t("contacts.table.emptyDash")}</span>
  );

  if (allPhones.length === 0) {
    return <>{emptyDash}</>;
  }

  return (
    <div className="space-y-2 min-w-0">
      {allPhones.map((p, idx) => (
        <ContactPhoneAction
          key={`phone-${p.phone}-${idx}`}
          phone={p.phone}
          countryCode={p.countryCode}
          phoneDisplay={p.phoneDisplay}
          name={displayName}
          emptyFallback={emptyDash}
          copyToast={t("contacts.table.copied")}
          labels={{
            call: t("contacts.detail.call"),
            sms: t("contacts.sms"),
            whatsapp: t("contacts.whatsapp"),
            copy: t("contacts.table.copy"),
            copied: t("contacts.table.copied"),
          }}
          onWhatsApp={onWhatsApp ? () => onWhatsApp([contact]) : undefined}
        />
      ))}
    </div>
  );
}

export interface RenderContactEmailCellParams {
  contact: Contact;
  widthStyle: CSSProperties | undefined;
  t: ContactCellTranslate;
}

export function renderContactEmailCell({
  contact,
  widthStyle: _widthStyle,
  t,
}: RenderContactEmailCellParams): React.JSX.Element {
  const allEmails = resolveAllContactEmails(contact);
  const displayName = getDisplayName(contact) || "";
  const emptyDash = (
    <span className="text-sm text-muted-foreground">{t("contacts.table.emptyDash")}</span>
  );

  if (allEmails.length === 0) {
    return <>{emptyDash}</>;
  }

  return (
    <div className="space-y-2 min-w-0">
      {allEmails.map((e, idx) => (
        <ContactEmailAction
          key={`email-${e.email}-${idx}`}
          email={e.email}
          name={displayName}
          emptyFallback={emptyDash}
          copyToast={t("contacts.table.copied")}
          labels={{
            mail: t("contacts.detail.emailAction"),
            copy: t("contacts.table.copy"),
            copied: t("contacts.table.copied"),
          }}
        />
      ))}
    </div>
  );
}

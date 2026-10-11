import React from "react";
import { CheckCircle2, MapPin } from "lucide-react";
import { type Contact, hasWhatsApp, getPrimaryAddress, type AppTranslationKey } from "@mms/shared";
import { formatContactGenderLabel } from "@/lib/contacts/contactI18n";
import { GenderIcon } from "@/components/ui/GenderIcon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { getGenderIconClass } from "@/lib/genderUi";
import { cn } from "@/lib/utils";

type Translate = (key: AppTranslationKey, params?: Record<string, string | number>) => string;

export function renderGenderMetadata({
  contact,
  emptyNode,
  t,
}: {
  contact: Contact;
  emptyNode: React.ReactNode;
  t: Translate;
}): React.ReactNode {
  const genderValue = contact.gender;
  if (!genderValue) return emptyNode;
  return (
    <span className="flex items-center gap-1.5 capitalize">
      <GenderIcon
        gender={genderValue}
        className={cn("w-3.5 h-3.5 shrink-0", getGenderIconClass(genderValue))}
      />
      <span>{formatContactGenderLabel(genderValue, t)}</span>
    </span>
  );
}

export function renderSyedMetadata({
  contact,
  emptyNode,
  t,
}: {
  contact: Contact;
  emptyNode: React.ReactNode;
  t: Translate;
}): React.ReactNode {
  return contact.isSyed ? (
    <Badge size="sm" tone="success" className="gap-1 font-semibold">
      <CheckCircle2 className="w-3 h-3 text-success inline shrink-0" aria-hidden />
      <span>{t("contacts.table.yesSyed")}</span>
    </Badge>
  ) : (
    emptyNode
  );
}

export function renderAddressFieldMetadata({
  contact,
  colId,
  emptyNode,
}: {
  contact: Contact;
  colId: "city" | "country" | "state" | "line1";
  emptyNode: React.ReactNode;
}): React.ReactNode {
  const primaryAddr = getPrimaryAddress(contact);
  const addressValue =
    primaryAddr?.[colId] || (contact[colId as keyof Contact] as string | undefined);
  if (!addressValue) return emptyNode;
  return (
    <span className="flex min-w-0 items-center gap-1 truncate">
      <MapPin className="w-3.5 h-3.5 text-primary/70 shrink-0" />
      <span className="min-w-0 truncate">{String(addressValue)}</span>
    </span>
  );
}

export function renderWhatsAppMetadata({ contact }: { contact: Contact }): React.ReactNode {
  return <StatusBadge status={hasWhatsApp(contact) ? "success" : "none"} size="sm" />;
}

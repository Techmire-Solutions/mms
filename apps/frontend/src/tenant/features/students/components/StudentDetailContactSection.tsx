import React from "react";
import { ArrowUpRight, IdCard, MapPin, ShieldCheck, Tag } from "lucide-react";
import type {
  Address,
  EmailAddress,
  PhoneNumber,
  StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";
import { toMessagingRecipient } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import {
  MESSAGING_ICON_BTN,
  MESSAGING_ICON_BTN_TONES,
} from "@/components/app/messagingActionStyles";
import { StudentDetailContactChannels } from "./StudentDetailContactChannels";

export interface StudentContactProfileData {
  contactId?: string;
  displayName: string;
  phones: PhoneNumber[];
  emails: EmailAddress[];
  addresses: Address[];
  cnic?: string;
  isSyed?: boolean;
  tags?: string[];
}

export interface StudentDetailContactSectionProps {
  contactProfile?: StudentContactProfileData | null;
  canMessage?: boolean;
  openComposer?: (channel: "sms" | "whatsapp" | "email", recipients: MessagingRecipient[]) => void;
  onNavigateToContact?: (contactId: string | number) => void;
}

export function StudentDetailContactSection({
  contactProfile,
  canMessage = true,
  openComposer,
  onNavigateToContact,
}: StudentDetailContactSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!contactProfile) return null;

  const {
    contactId,
    displayName,
    phones,
    emails,
    addresses,
    cnic,
    isSyed,
    tags = [],
  } = contactProfile;

  const hasAnyContactData =
    phones.length > 0 ||
    emails.length > 0 ||
    addresses.length > 0 ||
    Boolean(cnic) ||
    Boolean(isSyed) ||
    tags.length > 0;

  if (!hasAnyContactData && !contactId) return null;

  const handleWhatsApp = (phoneNum: string) => {
    if (!canMessage || !openComposer || !phoneNum) return;
    openComposer("whatsapp", [
      toMessagingRecipient({
        id: contactId || `student-contact`,
        name: displayName,
        phone: phoneNum,
      }),
    ]);
  };

  const handleSms = (phoneNum: string) => {
    if (!canMessage || !openComposer || !phoneNum) return;
    openComposer("sms", [
      toMessagingRecipient({
        id: contactId || `student-contact`,
        name: displayName,
        phone: phoneNum,
      }),
    ]);
  };

  const handleEmail = (emailAddress: string) => {
    if (!canMessage || !openComposer || !emailAddress) return;
    openComposer("email", [
      toMessagingRecipient({
        id: contactId || `student-contact`,
        name: displayName,
        email: emailAddress,
      }),
    ]);
  };

  return (
    <div className="pt-2">
      <DetailSectionCard
        title={t("students.detail.contactProfile")}
        accentColor="primary"
        className="p-3.5 space-y-3"
      >
        {contactId && onNavigateToContact && (
          <div className="flex justify-end -mt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onNavigateToContact(contactId)}
              className={cn(
                MESSAGING_ICON_BTN,
                MESSAGING_ICON_BTN_TONES.link,
                "h-7 px-2 text-xs gap-1 font-medium",
              )}
              title={t("students.detail.viewInContacts")}
            >
              <span>{t("students.detail.viewInContacts")}</span>
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
            </Button>
          </div>
        )}
        <StudentDetailContactChannels
          phones={phones}
          emails={emails}
          canMessage={canMessage}
          hasOpenComposer={Boolean(openComposer)}
          onWhatsApp={handleWhatsApp}
          onSms={handleSms}
          onEmail={handleEmail}
        />

        {addresses.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider block">
              {t("students.detail.addressesLabel")}
            </span>
            {addresses.map((addr, idx) => {
              const formatted = [addr.line1, addr.city, addr.state, addr.country]
                .filter(Boolean)
                .join(", ");
              if (!formatted) return null;
              return (
                <div
                  key={`student-addr-${idx}`}
                  className="flex items-start gap-2 py-1 px-2.5 rounded-lg bg-muted/30 text-xs text-muted-foreground"
                >
                  <MapPin
                    className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5"
                    aria-hidden
                  />
                  <span className="truncate flex-1">{formatted}</span>
                  {addr.label && (
                    <span className="text-2xs uppercase tracking-tight font-medium shrink-0">
                      {addr.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(cnic || isSyed || tags.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/50 text-xs">
            {cnic && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <IdCard className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
                <span className="font-medium text-foreground">{cnic}</span>
              </div>
            )}
            {isSyed && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-success shrink-0" aria-hidden />
                <span className="font-medium text-success">{t("contacts.fields.isSyed")}</span>
              </div>
            )}
            {tags.length > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground col-span-full flex-wrap">
                <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-muted px-1.5 py-0.5 rounded text-2xs font-medium text-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </DetailSectionCard>
    </div>
  );
}

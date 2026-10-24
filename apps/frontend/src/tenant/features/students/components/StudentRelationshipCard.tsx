import React from "react";
import { ArrowUpRight, FileText, IdCard } from "lucide-react";
import type {
  Contact,
  EmailAddress,
  PhoneNumber,
  StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";
import { toMessagingRecipient } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/app/UserAvatar";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import {
  MESSAGING_ICON_BTN,
  MESSAGING_ICON_BTN_TONES,
} from "@/components/app/messagingActionStyles";
import { StudentRelationshipContactList } from "./StudentRelationshipContactList";

export interface StudentRelationshipCardData {
  key: string;
  contactId?: string;
  name: string;
  avatar?: string | null;
  gender?: string;
  relationship: string;
  relationshipLabel: string;
  badgeCode: string;
  badgeTone: string;
  inferred?: boolean;
  derivedSibling?: boolean;
  phones: PhoneNumber[];
  emails: EmailAddress[];
  cnic?: string;
  notes?: string;
  targetContact?: Contact;
}

export interface StudentRelationshipCardProps {
  relationship: StudentRelationshipCardData;
  canMessage?: boolean;
  openComposer?: (channel: "sms" | "whatsapp" | "email", recipients: MessagingRecipient[]) => void;
  onNavigateToContact?: (contactId: string | number) => void;
}

export function StudentRelationshipCard({
  relationship,
  canMessage = true,
  openComposer,
  onNavigateToContact,
}: StudentRelationshipCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    name,
    avatar,
    contactId,
    relationshipLabel,
    badgeCode,
    badgeTone,
    inferred,
    phones,
    emails,
    cnic,
    notes,
  } = relationship;

  const handleWhatsApp = (phoneNum: string) => {
    if (!canMessage || !openComposer || !phoneNum) return;
    openComposer("whatsapp", [
      toMessagingRecipient({
        id: contactId || `rel-${name}`,
        name,
        phone: phoneNum,
      }),
    ]);
  };

  const handleSms = (phoneNum: string) => {
    if (!canMessage || !openComposer || !phoneNum) return;
    openComposer("sms", [
      toMessagingRecipient({
        id: contactId || `rel-${name}`,
        name,
        phone: phoneNum,
      }),
    ]);
  };

  const handleEmail = (emailAddress: string) => {
    if (!canMessage || !openComposer || !emailAddress) return;
    openComposer("email", [
      toMessagingRecipient({
        id: contactId || `rel-${name}`,
        name,
        email: emailAddress,
      }),
    ]);
  };

  return (
    <div className="p-3.5 space-y-3 transition-colors hover:bg-muted/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar
            id={contactId || name}
            name={name}
            avatar={avatar}
            gender={relationship.gender}
            className="w-10 h-10 rounded-xl text-xs shrink-0 ring-1 ring-border/40 shadow-xs"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-bold uppercase tracking-wider",
                  badgeTone,
                )}
              >
                {badgeCode || relationshipLabel}
              </span>
              {inferred && (
                <span className="text-2xs font-medium text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded">
                  {t("students.detail.inferred")}
                </span>
              )}
            </div>
            <h5 className="text-sm font-bold text-foreground truncate mt-0.5" title={name}>
              {name}
            </h5>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {contactId && onNavigateToContact && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onNavigateToContact(contactId)}
              className={cn(
                MESSAGING_ICON_BTN,
                MESSAGING_ICON_BTN_TONES.link,
                "flex items-center justify-center shadow-none",
              )}
              title={t("contacts.detail.viewContact", { name })}
              aria-label={t("contacts.detail.viewContact", { name })}
            >
              <ArrowUpRight className="w-4 h-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>

      <StudentRelationshipContactList
        phones={phones}
        emails={emails}
        canMessage={canMessage}
        hasOpenComposer={Boolean(openComposer)}
        onWhatsApp={handleWhatsApp}
        onSms={handleSms}
        onEmail={handleEmail}
      />

      {(cnic || notes) && (
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
          {cnic && (
            <div className="flex items-center gap-1.5">
              <IdCard className="w-3.5 h-3.5" aria-hidden />
              <span>{cnic}</span>
            </div>
          )}
          {notes && (
            <div className="flex items-center gap-1.5 truncate max-w-full">
              <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden />
              <span className="truncate italic" title={notes}>
                {notes}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

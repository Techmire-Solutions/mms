import React from "react";
import { Phone, MessageCircle, MessageSquare } from "lucide-react";
import { MESSAGING_ICON_BTN_TONES } from "@/components/app/messagingActionStyles";
import { cn } from "@/lib/utils";
import { ActionCopyButton, ActionIconButton } from "./contactActionShared";

export interface ContactPhoneActionButtonsProps {
  canCall: boolean;
  canWa: boolean;
  canSms: boolean;
  canCopy: boolean;
  callLabel: string;
  waLabel: string;
  smsLabel: string;
  telHref?: string | null;
  waHref?: string | null;
  smsHref?: string | null;
  onCall?: () => void;
  onWhatsApp?: () => void;
  onSms?: () => void;
  formattedPhone: string;
  copyToast?: string;
  labels?: {
    copy?: string;
    copied?: string;
  };
  actionsClassName?: string;
}

export function ContactPhoneActionButtons({
  canCall,
  canWa,
  canSms,
  canCopy,
  callLabel,
  waLabel,
  smsLabel,
  telHref,
  waHref,
  smsHref,
  onCall,
  onWhatsApp,
  onSms,
  formattedPhone,
  copyToast,
  labels,
  actionsClassName,
}: ContactPhoneActionButtonsProps): React.JSX.Element {
  return (
    <div
      className={cn("flex items-center gap-1", actionsClassName)}
      onClick={(e) => e.stopPropagation()}
    >
      {canCall ? (
        <ActionIconButton
          icon={Phone}
          label={callLabel}
          tooltipText={callLabel}
          href={onCall ? undefined : telHref || undefined}
          toneClass={MESSAGING_ICON_BTN_TONES.call}
          onClick={onCall}
        />
      ) : null}
      {canWa ? (
        <ActionIconButton
          icon={MessageCircle}
          label={waLabel}
          tooltipText={waLabel}
          href={onWhatsApp ? undefined : waHref || undefined}
          target="_blank"
          rel="noopener noreferrer"
          toneClass={MESSAGING_ICON_BTN_TONES.whatsapp}
          onClick={onWhatsApp}
        />
      ) : null}
      {canSms ? (
        <ActionIconButton
          icon={MessageSquare}
          label={smsLabel}
          tooltipText={smsLabel}
          href={onSms ? undefined : smsHref || undefined}
          toneClass={MESSAGING_ICON_BTN_TONES.sms}
          onClick={onSms}
        />
      ) : null}
      {canCopy ? (
        <ActionCopyButton
          text={formattedPhone}
          copyToastMessage={copyToast}
          tooltipCopyText={labels?.copy}
          tooltipCopiedText={labels?.copied}
        />
      ) : null}
    </div>
  );
}

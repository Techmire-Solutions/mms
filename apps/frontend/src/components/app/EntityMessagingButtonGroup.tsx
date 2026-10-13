import React from "react";
import { Mail, MessageCircle, MessageSquare, Phone } from "lucide-react";
import { QuickActionButton } from "@/components/ui/QuickActionButton";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import {
  MESSAGING_QUICK_ACTION_BASE,
  MESSAGING_QUICK_ACTION_TONES,
} from "@/components/ui/messagingActionStyles";
import { cn } from "@/lib/utils";

export interface EntityMessagingButtonGroupProps {
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  showCall?: boolean;
  showWhatsApp?: boolean;
  showSms?: boolean;
  showEmail?: boolean;
  callLabel: string;
  whatsappLabel: string;
  smsLabel: string;
  emailLabel: string;
  callAriaLabel?: string;
  telHref?: string | null;
  onCall?: () => void;
  onWhatsApp?: () => void;
  onSms?: () => void;
  onEmail?: () => void;
  className?: string;
}

const ACTION_BASE = cn(WORK_SURFACE_INNER, MESSAGING_QUICK_ACTION_BASE, "shadow-none");

export function EntityMessagingButtonGroup({
  primaryPhone,
  primaryEmail,
  showCall,
  showWhatsApp,
  showSms,
  showEmail,
  callLabel,
  whatsappLabel,
  smsLabel,
  emailLabel,
  callAriaLabel,
  telHref,
  onCall,
  onWhatsApp,
  onSms,
  onEmail,
  className,
}: EntityMessagingButtonGroupProps): React.JSX.Element {
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}>
      {showCall && primaryPhone && (
        <QuickActionButton
          label={callLabel}
          icon={Phone}
          href={telHref || `tel:${primaryPhone}`}
          onClick={onCall}
          ariaLabel={callAriaLabel ?? `${callLabel} ${primaryPhone}`}
          className={cn(ACTION_BASE, MESSAGING_QUICK_ACTION_TONES.call)}
        />
      )}
      {showWhatsApp && onWhatsApp && (
        <QuickActionButton
          label={whatsappLabel}
          icon={MessageCircle}
          onClick={onWhatsApp}
          className={cn(ACTION_BASE, MESSAGING_QUICK_ACTION_TONES.whatsapp)}
        />
      )}
      {showSms && onSms && (
        <QuickActionButton
          label={smsLabel}
          icon={MessageSquare}
          onClick={onSms}
          className={cn(ACTION_BASE, MESSAGING_QUICK_ACTION_TONES.sms)}
        />
      )}
      {showEmail && onEmail && (
        <QuickActionButton
          label={emailLabel}
          icon={Mail}
          onClick={onEmail}
          className={cn(ACTION_BASE, MESSAGING_QUICK_ACTION_TONES.email)}
        />
      )}
    </div>
  );
}

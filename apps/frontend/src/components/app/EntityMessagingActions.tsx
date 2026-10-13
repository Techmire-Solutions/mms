import React from "react";
import { Mail, MessageCircle, MessageSquare, Phone } from "lucide-react";
import {
  sanitizeEmailForMailto,
  sanitizePhoneForSms,
  sanitizePhoneForTel,
  sanitizePhoneForWhatsApp,
} from "@mms/shared";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MessagingActionButton } from "@/components/ui/MessagingActionButton";
import { EntityMessagingButtonGroup } from "@/components/ui/EntityMessagingButtonGroup";
import { MESSAGING_ICON_BTN_TONES } from "@/components/ui/messagingActionStyles";
import { cn } from "@/lib/utils";

export type EntityMessagingVariant = "dropdown" | "icon-row" | "button-group";

export interface EntityMessagingLabels {
  call?: string;
  whatsapp?: string;
  sms?: string;
  email?: string;
}

export interface EntityMessagingActionsProps {
  variant?: EntityMessagingVariant;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  labels: EntityMessagingLabels;
  callAriaLabel?: string;
  whatsappAriaLabel?: string;
  smsAriaLabel?: string;
  emailAriaLabel?: string;
  onCall?: () => void;
  onWhatsApp?: () => void;
  onSms?: () => void;
  onEmail?: () => void;
  messagingEnabled?: boolean;
  showCall?: boolean;
  showWhatsApp?: boolean;
  showSms?: boolean;
  showEmail?: boolean;
  showArchived?: boolean;
  className?: string;
}

/**
 * Consolidated entity messaging action dispatcher supporting dropdown menus,
 * dense icon-rows, and responsive button-group grids.
 */
export function EntityMessagingActions({
  variant = "icon-row",
  primaryPhone,
  primaryEmail,
  labels,
  callAriaLabel,
  whatsappAriaLabel,
  smsAriaLabel,
  emailAriaLabel,
  onCall,
  onWhatsApp,
  onSms,
  onEmail,
  messagingEnabled = true,
  showCall: showCallProp = true,
  showWhatsApp: showWaProp,
  showSms: showSmsProp,
  showEmail: showEmailProp,
  showArchived = false,
  className,
}: EntityMessagingActionsProps): React.JSX.Element | null {
  if (showArchived) return null;

  const telHref = primaryPhone ? sanitizePhoneForTel(primaryPhone) : null;
  const waHref = primaryPhone ? sanitizePhoneForWhatsApp(primaryPhone) : null;
  const smsHref = primaryPhone ? sanitizePhoneForSms(primaryPhone) : null;
  const mailHref = primaryEmail ? sanitizeEmailForMailto(primaryEmail) : null;

  const showCall = showCallProp && Boolean(telHref || primaryPhone || onCall);
  const showWhatsApp =
    showWaProp ?? Boolean(messagingEnabled && (onWhatsApp || waHref) && primaryPhone);
  const showSms = showSmsProp ?? Boolean(messagingEnabled && (onSms || smsHref) && primaryPhone);
  const showEmail =
    showEmailProp ?? Boolean(messagingEnabled && (onEmail || mailHref) && primaryEmail);

  if (!showCall && !showWhatsApp && !showSms && !showEmail) return null;

  const callLabel = callAriaLabel ?? labels.call ?? "Call";
  const whatsappLabel = whatsappAriaLabel ?? labels.whatsapp ?? "WhatsApp";
  const smsLabel = smsAriaLabel ?? labels.sms ?? "SMS";
  const emailLabel = emailAriaLabel ?? labels.email ?? "Email";

  if (variant === "dropdown") {
    return (
      <>
        {showWhatsApp && (
          <DropdownMenuItem onClick={onWhatsApp}>
            <MessageCircle className="w-3.5 h-3.5 me-2 text-success" /> {whatsappLabel}
          </DropdownMenuItem>
        )}
        {showSms && (
          <DropdownMenuItem onClick={onSms}>
            <MessageSquare className="w-3.5 h-3.5 me-2 text-info" /> {smsLabel}
          </DropdownMenuItem>
        )}
        {showEmail && (
          <DropdownMenuItem onClick={onEmail}>
            <Mail className="w-3.5 h-3.5 me-2 text-primary" /> {emailLabel}
          </DropdownMenuItem>
        )}
      </>
    );
  }

  if (variant === "button-group") {
    return (
      <EntityMessagingButtonGroup
        primaryPhone={primaryPhone}
        primaryEmail={primaryEmail}
        showCall={showCall}
        showWhatsApp={showWhatsApp}
        showSms={showSms}
        showEmail={showEmail}
        callLabel={callLabel}
        whatsappLabel={whatsappLabel}
        smsLabel={smsLabel}
        emailLabel={emailLabel}
        callAriaLabel={callAriaLabel}
        telHref={telHref}
        onCall={onCall}
        onWhatsApp={onWhatsApp}
        onSms={onSms}
        onEmail={onEmail}
        className={className}
      />
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        {showCall && (
          <MessagingActionButton
            icon={Phone}
            label={callLabel}
            ariaLabel={callLabel ? `${callLabel} ${primaryPhone}` : primaryPhone || undefined}
            toneClass={MESSAGING_ICON_BTN_TONES.call}
            href={onCall ? undefined : telHref || `tel:${primaryPhone}`}
            onClick={onCall}
          />
        )}
        {showWhatsApp && (
          <MessagingActionButton
            icon={MessageCircle}
            label={whatsappLabel}
            ariaLabel={whatsappLabel || undefined}
            toneClass={MESSAGING_ICON_BTN_TONES.whatsapp}
            href={onWhatsApp ? undefined : waHref}
            onClick={onWhatsApp}
            targetBlank={!onWhatsApp}
          />
        )}
        {showSms && (
          <MessagingActionButton
            icon={MessageSquare}
            label={smsLabel}
            ariaLabel={smsLabel || undefined}
            toneClass={MESSAGING_ICON_BTN_TONES.sms}
            href={onSms ? undefined : smsHref}
            onClick={onSms}
          />
        )}
        {showEmail && (
          <MessagingActionButton
            icon={Mail}
            label={emailLabel}
            ariaLabel={emailLabel || undefined}
            toneClass={MESSAGING_ICON_BTN_TONES.email}
            href={onEmail ? undefined : mailHref}
            onClick={onEmail}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

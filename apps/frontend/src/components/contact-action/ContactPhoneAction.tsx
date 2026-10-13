import React, { type ReactNode } from "react";
import { Phone } from "lucide-react";
import {
  sanitizePhoneForSms,
  sanitizePhoneForTel,
  sanitizePhoneForWhatsApp,
  formatPhoneWithCountryCode,
  parsePhoneNumber,
  APP_TRANSLATIONS_EN,
  type AppTranslationKey,
} from "@mms/shared";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { type ContactActionVariant } from "./contactActionShared";
import { ContactPhoneActionButtons } from "./ContactPhoneActionButtons";

export interface ContactPhoneActionProps {
  /** Raw phone number or E.164 phone string */
  phone?: string | null;
  /** Country code prefix to display or fallback (e.g. "+92") */
  countryCode?: string | null;
  /** Formatted phone display text (e.g. "300 1234567") */
  phoneDisplay?: string | null;
  /** Contact display name for aria-labels and tooltips */
  name?: string;
  /** Visual presentation variant. Default is "stacked" (value on top, action links underneath). */
  variant?: ContactActionVariant;
  /** Whether to show the Copy button. Default true. */
  showCopy?: boolean;
  /** Whether to show the Call tel: action. Default true. */
  showCall?: boolean;
  /** Whether to show the WhatsApp wa.me action. Default true. */
  showWhatsApp?: boolean;
  /** Whether to show the SMS sms: action. Default true. */
  showSms?: boolean;
  /** Custom handler for WhatsApp click. If omitted, opens https://wa.me/... */
  onWhatsApp?: () => void;
  /** Custom handler for SMS click. If omitted, opens sms:... */
  onSms?: () => void;
  /** Custom handler for Call click. If omitted, opens tel:... */
  onCall?: () => void;
  /** When true, disable/hide actions (e.g. archived / soft-deleted records). */
  disabled?: boolean;
  /** Fallback placeholder when phone is null/empty. Default is "—". */
  emptyFallback?: ReactNode;
  /** Toast message on copy */
  copyToast?: string;
  /** Custom container class */
  className?: string;
  /** Custom action buttons row class */
  actionsClassName?: string;
  /** Custom labels for action tooltips / aria */
  labels?: {
    call?: string;
    sms?: string;
    whatsapp?: string;
    copy?: string;
    copied?: string;
  };
}

export const ContactPhoneAction = function ContactPhoneAction({
  phone,
  countryCode: countryCodeProp,
  phoneDisplay: phoneDisplayProp,
  name,
  variant = "stacked",
  showCopy = true,
  showCall = true,
  showWhatsApp = true,
  showSms = true,
  onWhatsApp,
  onSms,
  onCall,
  disabled = false,
  emptyFallback = <span className="text-sm text-muted-foreground">—</span>,
  copyToast,
  className,
  actionsClassName,
  labels,
}: ContactPhoneActionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const rawPhone = (phone || "").trim();

  if (!rawPhone) {
    return emptyFallback ? <>{emptyFallback}</> : null;
  }

  const defaultCountryCode = countryCodeProp?.trim() || "";
  const formattedPhone = formatPhoneWithCountryCode(rawPhone, defaultCountryCode) || rawPhone;
  const parsed = parsePhoneNumber(formattedPhone, defaultCountryCode);
  const countryCode = countryCodeProp || parsed.countryCode;
  const phoneDisplay = phoneDisplayProp || parsed.number || rawPhone;

  const telHref = sanitizePhoneForTel(formattedPhone, defaultCountryCode);
  const smsHref = sanitizePhoneForSms(formattedPhone, defaultCountryCode);
  const waHref = sanitizePhoneForWhatsApp(formattedPhone, defaultCountryCode);

  const canCall = showCall && !disabled && (Boolean(telHref) || Boolean(onCall));
  const canSms = showSms && !disabled && (Boolean(smsHref) || Boolean(onSms));
  const canWa = showWhatsApp && !disabled && (Boolean(waHref) || Boolean(onWhatsApp));
  const canCopy = showCopy && Boolean(formattedPhone);

  const targetName = name ? ` (${name})` : "";
  const resolveVerb = (k: AppTranslationKey, fallback: string) => {
    const val = t(k);
    return val && val !== k ? val : (APP_TRANSLATIONS_EN[k] ?? fallback);
  };
  const callLabel = labels?.call
    ? `${labels.call}${targetName}`
    : `${resolveVerb("contacts.detail.call", "Call")} ${formattedPhone}${targetName}`;
  const smsLabel = labels?.sms
    ? `${labels.sms}${targetName}`
    : `${resolveVerb("contacts.sms", "SMS")} ${formattedPhone}${targetName}`;
  const waLabel = labels?.whatsapp
    ? `${labels.whatsapp}${targetName}`
    : `${resolveVerb("contacts.whatsapp", "WhatsApp")} ${formattedPhone}${targetName}`;
  const effectiveLabels = {
    copy: labels?.copy ?? resolveVerb("contacts.table.copy", "Copy"),
    copied: labels?.copied ?? resolveVerb("contacts.table.copied", "Copied!"),
  };

  const actionsNode = (
    <ContactPhoneActionButtons
      canCall={Boolean(canCall)}
      canWa={Boolean(canWa)}
      canSms={Boolean(canSms)}
      canCopy={Boolean(canCopy)}
      callLabel={callLabel}
      waLabel={waLabel}
      smsLabel={smsLabel}
      telHref={telHref}
      waHref={waHref}
      smsHref={smsHref}
      onCall={onCall}
      onWhatsApp={onWhatsApp}
      onSms={onSms}
      formattedPhone={formattedPhone}
      copyToast={copyToast}
      labels={effectiveLabels}
      actionsClassName={actionsClassName}
    />
  );

  if (variant === "actions-only") {
    return <TooltipProvider delayDuration={200}>{actionsNode}</TooltipProvider>;
  }

  if (variant === "pill") {
    return (
      <TooltipProvider delayDuration={200}>
        <div
          className={cn(
            WORK_SURFACE_INNER,
            "w-full flex items-center justify-between text-xs font-normal text-muted-foreground hover:bg-muted/65 hover:text-foreground px-3 py-1.5 rounded-xl group/pill min-w-0 transition-colors gap-2",
            className,
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 pe-2">
            <Phone
              aria-hidden="true"
              className="w-3.5 h-3.5 text-primary/80 flex-shrink-0 group-hover/pill:text-primary transition-colors"
            />
            <span className="font-semibold tracking-tight truncate select-all">
              {formattedPhone}
            </span>
          </div>
          {actionsNode}
        </div>
      </TooltipProvider>
    );
  }

  const valueDisplayNode = (
    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/60 max-w-full">
      {countryCode ? (
        <span className="text-xs font-semibold text-muted-foreground shrink-0">{countryCode}</span>
      ) : null}
      <span className="text-sm font-mono text-foreground font-medium tracking-wide truncate select-all">
        {phoneDisplay}
      </span>
    </div>
  );

  if (variant === "inline") {
    return (
      <TooltipProvider delayDuration={200}>
        <div className={cn("flex flex-wrap items-center gap-2", className)}>
          {valueDisplayNode}
          {actionsNode}
        </div>
      </TooltipProvider>
    );
  }

  // Default: stacked layout
  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex flex-col items-start gap-1 group/phone", className)}>
        {valueDisplayNode}
        {actionsNode}
      </div>
    </TooltipProvider>
  );
};

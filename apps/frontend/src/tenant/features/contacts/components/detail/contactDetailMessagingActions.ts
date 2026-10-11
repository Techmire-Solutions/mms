import { Mail, MessageCircle, MessageSquare, Phone, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MESSAGING_ICON_BTN,
  MESSAGING_ICON_BTN_TONES,
} from "@/components/ui/messagingActionStyles";
import { formatTelHref } from "@/lib/contacts/contactPhoneDisplay";
import type { CollectionRowAction } from "./CollectionRowItem";

type MessagingTone = keyof typeof MESSAGING_ICON_BTN_TONES;

function messagingActionClass(tone: MessagingTone): string {
  return cn(MESSAGING_ICON_BTN, MESSAGING_ICON_BTN_TONES[tone]);
}

interface DetailMessagingRowActionInput {
  key: string;
  tone: MessagingTone;
  icon: LucideIcon;
  title: string;
  href?: string;
  onClick?: () => void;
}

/** Build a CollectionRowAction with shared messaging icon button tones. */
function detailMessagingRowAction(input: DetailMessagingRowActionInput): CollectionRowAction {
  return {
    key: input.key,
    icon: input.icon,
    title: input.title,
    href: input.href,
    onClick: input.onClick,
    className: messagingActionClass(input.tone),
  };
}

interface BuildDetailPhoneMessagingActionsArgs {
  phone: string;
  callTitle: string;
  whatsappTitle?: string;
  smsTitle?: string;
  onWhatsApp?: () => void;
  onSms?: () => void;
}

/** Call / WhatsApp / SMS row actions for a single detail phone row. */
export function buildDetailPhoneMessagingActions({
  phone,
  callTitle,
  whatsappTitle,
  smsTitle,
  onWhatsApp,
  onSms,
}: BuildDetailPhoneMessagingActionsArgs): CollectionRowAction[] {
  const actions: CollectionRowAction[] = [
    detailMessagingRowAction({
      key: "call",
      tone: "call",
      icon: Phone,
      title: callTitle,
      href: formatTelHref(phone),
    }),
  ];

  if (onWhatsApp && whatsappTitle) {
    actions.push(
      detailMessagingRowAction({
        key: "whatsapp",
        tone: "whatsapp",
        icon: MessageCircle,
        title: whatsappTitle,
        onClick: onWhatsApp,
      }),
    );
  }

  if (onSms && smsTitle) {
    actions.push(
      detailMessagingRowAction({
        key: "sms",
        tone: "sms",
        icon: MessageSquare,
        title: smsTitle,
        onClick: onSms,
      }),
    );
  }

  return actions;
}

interface BuildDetailEmailMessagingActionsArgs {
  emailTitle: string;
  onEmail: () => void;
}

/** Email row action for a single detail email row. */
export function buildDetailEmailMessagingActions({
  emailTitle,
  onEmail,
}: BuildDetailEmailMessagingActionsArgs): CollectionRowAction[] {
  return [
    detailMessagingRowAction({
      key: "email",
      tone: "email",
      icon: Mail,
      title: emailTitle,
      onClick: onEmail,
    }),
  ];
}

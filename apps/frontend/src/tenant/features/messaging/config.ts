import { Mail, MessageCircle, MessageSquare, type LucideIcon } from "lucide-react";
import type { CardAccentColor } from "@/lib/semanticTone";

export type MessagingChannel = "whatsapp" | "sms" | "email";

export interface MessagingChannelConfig {
  id: MessagingChannel;
  icon: LucideIcon;
  themeAccent: CardAccentColor;
  labelStatsKey: string;
  labelSendKey: string;
}

export const MESSAGING_CHANNEL_CONFIG: Record<MessagingChannel, MessagingChannelConfig> = {
  whatsapp: {
    id: "whatsapp",
    icon: MessageCircle,
    themeAccent: "success",
    labelStatsKey: "messaging.stats.whatsapp",
    labelSendKey: "messaging.sendWhatsapp",
  },
  sms: {
    id: "sms",
    icon: MessageSquare,
    themeAccent: "info",
    labelStatsKey: "messaging.stats.sms",
    labelSendKey: "messaging.sendSms",
  },
  email: {
    id: "email",
    icon: Mail,
    themeAccent: "warning",
    labelStatsKey: "messaging.stats.email",
    labelSendKey: "messaging.sendEmail",
  },
};

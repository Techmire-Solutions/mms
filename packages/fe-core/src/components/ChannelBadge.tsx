import React from "react";
import { Mail, MessageSquare, MessageCircle } from "lucide-react";
import { getChannelLabelKey } from "@mms/contracts";
import { useTranslation } from "../i18n/index.js";
import { Badge } from "@mms/ui";
import { cn } from "@mms/ui";

export interface ChannelBadgeProps {
  channel: "sms" | "whatsapp" | "email" | string;
  className?: string;
  showIcon?: boolean;
}

/** Frontend-only badge styling map (UI tokens do not belong in `@mms/contracts`). */
function getChannelBadgeStyle(channel: string): string {
  if (channel === "email") {
    return "bg-warning/10 text-warning border border-warning/20";
  }
  if (channel === "sms") {
    return "bg-info/10 text-info border border-info/20";
  }
  return "bg-success/10 text-success border border-success/20";
}

/**
 * Channel pill — Badge shell + channel style/label map.
 */
export function ChannelBadge({
  channel,
  className = "",
  showIcon = true,
}: ChannelBadgeProps): React.JSX.Element {
  const { t } = useTranslation();

  const Icon = channel === "email" ? Mail : channel === "sms" ? MessageSquare : MessageCircle;
  const labelKey = getChannelLabelKey(channel);

  return (
    <Badge
      as="span"
      size="sm"
      className={cn("font-black uppercase", getChannelBadgeStyle(channel), className)}
    >
      {showIcon && <Icon className="w-3 h-3 flex-shrink-0" aria-hidden />}
      {t(labelKey)}
    </Badge>
  );
}

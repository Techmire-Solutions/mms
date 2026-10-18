import React from "react";
import { Mail, MessageSquare, MessageCircle } from "lucide-react";
import { getChannelBadgeStyle, getChannelLabelKey } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ChannelBadgeProps {
  channel: "sms" | "whatsapp" | "email" | string;
  className?: string;
  showIcon?: boolean;
}

/**
 * Channel pill — Badge shell + shared channel style/label map.
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
      className={cn(
        "font-black uppercase border-transparent",
        getChannelBadgeStyle(channel),
        className,
      )}
    >
      {showIcon && <Icon className="w-3 h-3 flex-shrink-0" aria-hidden />}
      {t(labelKey)}
    </Badge>
  );
}

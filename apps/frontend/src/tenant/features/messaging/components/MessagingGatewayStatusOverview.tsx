import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Mail, MessageCircle, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WidgetCard } from "@/components/app/WidgetCard";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useMessagingGatewaysStatus,
  type GatewayStatusItem,
} from "../hooks/useMessagingGatewaysStatus";

interface GatewayChannelCardProps {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  item: GatewayStatusItem;
  settingsTab: string;
}

function GatewayChannelCard({
  name,
  icon: Icon,
  item,
  settingsTab,
}: GatewayChannelCardProps): React.JSX.Element {
  const { t } = useTranslation();

  const getStatusBadge = () => {
    if (item.isConnected) {
      return (
        <Badge variant="outline" className={`text-3xs font-medium ${SEMANTIC_BADGE.success}`}>
          {t("messaging.gateways.connected")}
        </Badge>
      );
    }
    if (item.isConfigured) {
      return (
        <Badge variant="outline" className={`text-3xs font-medium ${SEMANTIC_BADGE.warning}`}>
          {t("messaging.gateways.configured")}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className={`text-3xs font-medium ${SEMANTIC_BADGE.muted}`}>
        {t("messaging.gateways.notConfigured")}
      </Badge>
    );
  };

  return (
    <WidgetCard
      className="flex flex-col justify-between space-y-3"
      accentColor={item.isConnected ? "success" : item.isConfigured ? "warning" : undefined}
    >
      <div className="p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold">{name}</span>
          </div>
          {getStatusBadge()}
        </div>

        <div className="text-2xs text-muted-foreground space-y-0.5">
          <div className="flex justify-between">
            <span className="opacity-70">{t("messaging.gateways.provider")}:</span>
            <span className="font-medium text-foreground capitalize">{item.provider || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">{t("messaging.gateways.sender")}:</span>
            <span className="font-mono text-foreground truncate max-w-36">
              {item.sender || "—"}
            </span>
          </div>
        </div>
      </div>

      <Button
        asChild
        variant="ghost"
        size="sm"
        className="w-full h-7 text-xs text-muted-foreground hover:text-foreground justify-between px-2 cursor-pointer"
      >
        <Link to={`/settings?tab=${settingsTab}`}>
          <span>{t("messaging.gateways.configureInSettings")}</span>
          <ExternalLink className="h-3 w-3 ms-1 opacity-70" />
        </Link>
      </Button>
    </WidgetCard>
  );
}

export function MessagingGatewayStatusOverview(): React.JSX.Element {
  const { t } = useTranslation();
  const gateways = useMessagingGatewaysStatus();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{t("messaging.gateways.title")}</CardTitle>
        <CardDescription className="text-xs">{t("messaging.gateways.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <GatewayChannelCard
            name={t("messaging.channel.sms")}
            icon={MessageSquare}
            item={gateways.sms}
            settingsTab="sms"
          />
          <GatewayChannelCard
            name={t("messaging.channel.whatsapp")}
            icon={MessageCircle}
            item={gateways.whatsapp}
            settingsTab="whatsapp"
          />
          <GatewayChannelCard
            name={t("messaging.channel.email")}
            icon={Mail}
            item={gateways.email}
            settingsTab="email"
          />
        </div>
      </CardContent>
    </Card>
  );
}

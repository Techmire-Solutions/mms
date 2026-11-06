import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WidgetCard } from "@/components/app/WidgetCard";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import { Switch, Label } from "@shared/ui";
import { cn } from "@/lib/utils";
import type { GatewayStatusItem } from "../hooks/useMessagingGatewaysStatus";

export interface MessagingGatewayChannelCardProps {
  id: "sms" | "whatsapp" | "email";
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  item: GatewayStatusItem;
  isEnabled: boolean;
  isSelected: boolean;
  canWrite: boolean;
  onSelect: () => void;
  onToggleDelivery: (enabled: boolean) => void;
}

export function MessagingGatewayChannelCard({
  id,
  name,
  icon: Icon,
  item,
  isEnabled,
  isSelected,
  canWrite,
  onSelect,
  onToggleDelivery,
}: MessagingGatewayChannelCardProps): React.JSX.Element {
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
      className={cn(
        "flex flex-col justify-between space-y-3 transition-all",
        isSelected && "ring-2 ring-primary border-primary/50 shadow-sm",
      )}
      accentColor={item.isConnected ? "success" : item.isConfigured ? "warning" : undefined}
    >
      <div className="p-3.5 space-y-2.5">
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
          {item.lastError ? (
            <div
              className="truncate font-medium text-destructive"
              title={item.lastError}
              data-testid={`messaging-gateway-last-error-${item.provider ?? name}`}
            >
              {t("messaging.gateways.lastError")}: {item.lastError}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/50 text-2xs">
          <Label htmlFor={`delivery-toggle-${id}`} className="text-2xs font-medium cursor-pointer">
            {t("messaging.gateways.deliveryStatus")}
          </Label>
          <Switch
            id={`delivery-toggle-${id}`}
            checked={isEnabled}
            onCheckedChange={onToggleDelivery}
            disabled={!canWrite}
          />
        </div>
      </div>

      <div className="px-3.5 pb-3.5">
        <Button
          type="button"
          variant={isSelected ? "secondary" : "outline"}
          size="sm"
          className="w-full min-h-11 text-xs justify-center cursor-pointer"
          onClick={onSelect}
        >
          {t("messaging.gateways.configureGateway")}
        </Button>
      </div>
    </WidgetCard>
  );
}

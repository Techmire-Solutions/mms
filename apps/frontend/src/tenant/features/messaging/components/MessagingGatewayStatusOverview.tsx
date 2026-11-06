import React, { useState } from "react";
import { Mail, MessageCircle, MessageSquare } from "lucide-react";
import { getActiveNotificationChannels } from "@mms/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleRow } from "@shared/ui";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { getGlobalSettings, saveGlobalSettingsAsync } from "@/lib/db";
import { notify } from "@/lib/notify";
import { useMessagingGatewaysStatus } from "../hooks/useMessagingGatewaysStatus";
import { MessagingGatewayChannelCard } from "./MessagingGatewayChannelCard";
import SmsIntegrationPanel from "./SmsIntegrationPanel";
import WhatsAppIntegrationPanel from "./WhatsAppIntegrationPanel";
import EmailIntegrationPanel from "./EmailIntegrationPanel";

export type GatewayChannelType = "sms" | "whatsapp" | "email";

export interface MessagingGatewayStatusOverviewProps {
  canWrite?: boolean;
}

export function MessagingGatewayStatusOverview({
  canWrite = true,
}: MessagingGatewayStatusOverviewProps): React.JSX.Element {
  const { t } = useTranslation();
  const gateways = useMessagingGatewaysStatus();
  const globalSettings = useGlobalSettings();

  const [selectedChannel, setSelectedChannel] = useState<GatewayChannelType>("sms");
  const [toggling, setToggling] = useState<string | null>(null);

  const emailEnabled = Boolean(globalSettings.emailNotifications);
  const smsEnabled = Boolean(globalSettings.smsNotifications);
  const whatsappEnabled = Boolean(globalSettings.whatsAppNotifications);

  const activeChannels = getActiveNotificationChannels(globalSettings);

  const handleToggleChannel = async (
    field: "emailNotifications" | "smsNotifications" | "whatsAppNotifications",
    val: boolean,
  ): Promise<void> => {
    if (!canWrite) return;
    setToggling(field);
    try {
      const current = getGlobalSettings();
      const updated = { ...current, [field]: val };
      const res = await saveGlobalSettingsAsync(updated);
      if (res.ok) {
        notify.success(t("settings.savedBadge"));
      } else {
        notify.error(t("messaging.preferences.saveFailed"));
      }
    } catch {
      notify.error(t("messaging.preferences.saveFailed"));
    } finally {
      setToggling(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              {t("messaging.gateways.title")}
            </CardTitle>
            <CardDescription className="text-xs">{t("messaging.gateways.desc")}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium" aria-live="polite">
            <span className="text-muted-foreground">{t("global.notificationsActiveChannel")}:</span>
            {activeChannels.length === 0 ? (
              <Badge variant="outline" className={`text-3xs font-medium ${SEMANTIC_BADGE.muted}`}>
                {t("global.notificationsChannelNone")}
              </Badge>
            ) : (
              activeChannels.map((ch) => (
                <Badge
                  key={ch}
                  variant="outline"
                  className={`text-3xs font-medium ${SEMANTIC_BADGE.primary}`}
                >
                  {ch === "email" && t("global.notificationsChannelEmail")}
                  {ch === "sms" && t("global.notificationsChannelSms")}
                  {ch === "whatsapp" && t("global.notificationsChannelWhatsApp")}
                </Badge>
              ))
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MessagingGatewayChannelCard
            id="sms"
            name={t("messaging.channel.sms")}
            icon={MessageSquare}
            item={gateways.sms}
            isEnabled={smsEnabled}
            isSelected={selectedChannel === "sms"}
            canWrite={canWrite && toggling !== "smsNotifications"}
            onSelect={() => setSelectedChannel("sms")}
            onToggleDelivery={(val) => void handleToggleChannel("smsNotifications", val)}
          />
          <MessagingGatewayChannelCard
            id="whatsapp"
            name={t("messaging.channel.whatsapp")}
            icon={MessageCircle}
            item={gateways.whatsapp}
            isEnabled={whatsappEnabled}
            isSelected={selectedChannel === "whatsapp"}
            canWrite={canWrite && toggling !== "whatsAppNotifications"}
            onSelect={() => setSelectedChannel("whatsapp")}
            onToggleDelivery={(val) => void handleToggleChannel("whatsAppNotifications", val)}
          />
          <MessagingGatewayChannelCard
            id="email"
            name={t("messaging.channel.email")}
            icon={Mail}
            item={gateways.email}
            isEnabled={emailEnabled}
            isSelected={selectedChannel === "email"}
            canWrite={canWrite && toggling !== "emailNotifications"}
            onSelect={() => setSelectedChannel("email")}
            onToggleDelivery={(val) => void handleToggleChannel("emailNotifications", val)}
          />
        </div>

        <div className="mt-4 pt-4 border-t border-border space-y-3">
          {selectedChannel === "sms" && (
            <div className="space-y-3">
              <ToggleRow
                id="smsNotifications"
                label={t("global.smsNotifications")}
                description={t("global.smsNotificationsDesc")}
                checked={smsEnabled}
                onCheckedChange={(val) => void handleToggleChannel("smsNotifications", val)}
                disabled={!canWrite || toggling === "smsNotifications"}
              />
              <SmsIntegrationPanel />
            </div>
          )}

          {selectedChannel === "whatsapp" && (
            <div className="space-y-3">
              <ToggleRow
                id="whatsAppNotifications"
                label={t("global.whatsAppNotifications")}
                description={t("global.whatsAppNotificationsDesc")}
                checked={whatsappEnabled}
                onCheckedChange={(val) => void handleToggleChannel("whatsAppNotifications", val)}
                disabled={!canWrite || toggling === "whatsAppNotifications"}
              />
              <WhatsAppIntegrationPanel />
            </div>
          )}

          {selectedChannel === "email" && (
            <div className="space-y-3">
              <ToggleRow
                id="emailNotifications"
                label={t("global.emailNotifications")}
                description={t("global.emailNotificationsDesc")}
                checked={emailEnabled}
                onCheckedChange={(val) => void handleToggleChannel("emailNotifications", val)}
                disabled={!canWrite || toggling === "emailNotifications"}
              />
              <EmailIntegrationPanel />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

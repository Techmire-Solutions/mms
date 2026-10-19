import React from "react";
import { Bell } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  usePlatformSettingsQuery,
  useUpdatePlatformSettings,
} from "@/platform/hooks/usePlatformSettings";
import {
  DEFAULT_PLATFORM_SETTINGS,
  resolvePlatformNotificationChannel,
} from "@mms/shared";
import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Switch,
  CardSkeleton,
} from "@shared/ui";
import { PlatformEmailIntegrationPanel } from "@/platform/components/settings/PlatformEmailIntegrationPanel";
import { PlatformSmsIntegrationPanel } from "@/platform/components/settings/PlatformSmsIntegrationPanel";

export function PlatformNotificationsSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const { data: settings, isLoading } = usePlatformSettingsQuery();
  const updateSettings = useUpdatePlatformSettings();

  if (isLoading) return <CardSkeleton count={2} />;

  const emailOn = Boolean(settings?.emailNotifications);
  const smsOn = Boolean(settings?.smsNotifications);
  const platformChannel = resolvePlatformNotificationChannel(settings ?? DEFAULT_PLATFORM_SETTINGS);

  return (
    <div className="space-y-6 text-start">
      <Card className="rounded-xl border-border/60 shadow-xs">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            {t("platform.notifications")}
          </CardTitle>
          <CardDescription className="text-xs">{t("platform.notificationsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="flex flex-wrap items-center gap-2 text-xs font-medium"
            aria-live="polite"
          >
            <span className="text-muted-foreground">
              {t("global.notificationsActiveChannel")}:
            </span>
            {platformChannel === "both" && (
              <>
                <Badge as="span" tone="primary" size="sm">
                  {t("global.notificationsChannelEmail")}
                </Badge>
                <Badge as="span" tone="primary" size="sm">
                  {t("global.notificationsChannelSms")}
                </Badge>
              </>
            )}
            {platformChannel === "email" && (
              <Badge as="span" tone="primary" size="sm">
                {t("global.notificationsChannelEmail")}
              </Badge>
            )}
            {platformChannel === "sms" && (
              <Badge as="span" tone="primary" size="sm">
                {t("global.notificationsChannelSms")}
              </Badge>
            )}
            {platformChannel === "none" && (
              <Badge as="span" tone="warning" size="sm">
                {t("global.notificationsChannelNone")}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
            <div>
              <label
                htmlFor="platform-email-notifications"
                className="text-xs font-medium cursor-pointer"
              >
                {t("global.emailNotifications")}
              </label>
              <div className="text-3xs text-muted-foreground">
                {t("global.emailNotificationsDesc")}
              </div>
            </div>
            <Switch
              id="platform-email-notifications"
              checked={emailOn}
              onCheckedChange={(checked) => updateSettings.mutate({ emailNotifications: checked })}
              aria-label={t("global.emailNotifications")}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
            <div>
              <label
                htmlFor="platform-sms-notifications"
                className="text-xs font-medium cursor-pointer"
              >
                {t("global.smsNotifications")}
              </label>
              <div className="text-3xs text-muted-foreground">
                {t("global.smsNotificationsDesc")}
              </div>
            </div>
            <Switch
              id="platform-sms-notifications"
              checked={smsOn}
              onCheckedChange={(checked) => updateSettings.mutate({ smsNotifications: checked })}
              aria-label={t("global.smsNotifications")}
            />
          </div>
        </CardContent>
      </Card>

      {emailOn ? <PlatformEmailIntegrationPanel /> : null}
      {smsOn ? <PlatformSmsIntegrationPanel /> : null}
    </div>
  );
}

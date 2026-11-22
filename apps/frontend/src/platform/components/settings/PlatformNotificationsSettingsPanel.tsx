import React from "react";
import { Bell } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";
import { Alert } from "@/components/app/Alert";
import {
  usePlatformSettingsQuery,
  useUpdatePlatformSettings,
} from "@/platform/hooks/usePlatformSettings";
import { DEFAULT_PLATFORM_SETTINGS, resolvePlatformNotificationChannel } from "@mms/shared";
import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  ToggleRow,
  CardSkeleton,
} from "@shared/ui";
import { EmailIntegrationPanel } from "@/components/app/IntegrationPanels/EmailIntegrationPanel";
import { SmsIntegrationPanel } from "@/components/app/IntegrationPanels/SmsIntegrationPanel";
import {
  PLATFORM_EMAIL_INTEGRATION_API,
  PLATFORM_SMS_INTEGRATION_API,
} from "@/platform/components/settings/platformIntegrationAdapters";

export function PlatformNotificationsSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const [error, setError] = React.useState<string | null>(null);
  const { data: settings, isLoading } = usePlatformSettingsQuery();
  const updateSettings = useUpdatePlatformSettings();

  const save = async (patch: Parameters<typeof updateSettings.mutateAsync>[0]): Promise<void> => {
    setError(null);
    try {
      await updateSettings.mutateAsync(patch);
    } catch (err) {
      setError(getPlatformErrorMessage(err, t, undefined, "platform.loadFailed"));
    }
  };

  if (isLoading) return <CardSkeleton count={2} />;

  const emailOn = Boolean(settings?.emailNotifications);
  const smsOn = Boolean(settings?.smsNotifications);
  const whatsAppOn = Boolean(settings?.whatsAppNotifications);
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
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium" aria-live="polite">
            <span className="text-muted-foreground">{t("global.notificationsActiveChannel")}:</span>
            {platformChannel === "all" && (
              <>
                <Badge as="span" tone="primary" size="sm">
                  {t("global.notificationsChannelEmail")}
                </Badge>
                <Badge as="span" tone="primary" size="sm">
                  {t("global.notificationsChannelSms")}
                </Badge>
                <Badge as="span" tone="primary" size="sm">
                  {t("global.notificationsChannelWhatsApp")}
                </Badge>
              </>
            )}
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
            {platformChannel === "whatsapp" && (
              <Badge as="span" tone="primary" size="sm">
                {t("global.notificationsChannelWhatsApp")}
              </Badge>
            )}
            {platformChannel === "none" && (
              <Badge as="span" tone="warning" size="sm">
                {t("global.notificationsChannelNone")}
              </Badge>
            )}
          </div>

          <ToggleRow
            id="platform-email-notifications"
            variant="bordered"
            label={t("global.emailNotifications")}
            description={t("global.emailNotificationsDesc")}
            checked={emailOn}
            disabled={updateSettings.isPending}
            onCheckedChange={(checked) => void save({ emailNotifications: checked })}
          />

          <ToggleRow
            id="platform-sms-notifications"
            variant="bordered"
            label={t("global.smsNotifications")}
            description={t("global.smsNotificationsDesc")}
            checked={smsOn}
            disabled={updateSettings.isPending}
            onCheckedChange={(checked) => void save({ smsNotifications: checked })}
          />

          <ToggleRow
            id="platform-whatsapp-notifications"
            variant="bordered"
            label={t("global.whatsAppNotifications")}
            description={t("global.whatsAppNotificationsDesc")}
            checked={whatsAppOn}
            disabled={updateSettings.isPending}
            onCheckedChange={(checked) => void save({ whatsAppNotifications: checked })}
          />
        </CardContent>
      </Card>

      {error ? (
        <Alert tone="destructive" density="compact" role="alert" description={error} />
      ) : null}

      {emailOn ? (
        <EmailIntegrationPanel
          api={PLATFORM_EMAIL_INTEGRATION_API}
          idPrefix="platform-"
          descriptionKey="platformEmail.integrationDesc"
          secretFieldName="platformEmailSmtpPassword"
        />
      ) : null}
      {smsOn ? (
        <SmsIntegrationPanel
          api={PLATFORM_SMS_INTEGRATION_API}
          idPrefix="platform-"
          descriptionKey="platformSms.integrationDesc"
          secretFieldName="platformSmsAccountSecret"
          disableTest={(testPhone) => !testPhone.trim()}
          validateTestTarget
          resolveTestTarget={(_config, testPhone) => testPhone.trim()}
        />
      ) : null}
    </div>
  );
}

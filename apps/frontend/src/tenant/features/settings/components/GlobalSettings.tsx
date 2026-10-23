import React from "react";
import { Bell, Languages } from "lucide-react";
import {
  APP_LANGUAGES,
  DEFAULT_GLOBAL_SETTINGS,
  formatLanguageSelectLabel,
  getActiveNotificationChannels,
  isRtlLanguage,
  normalizeDateFormat,
  normalizeTimezone,
  type AppLanguageCode,
  type DateFormatId,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useSettingsGlobalDraft } from "@/lib/contexts/SettingsGlobalDraftContext";
import { FormSelect } from "@/components/app/FormSelect";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/app/SectionCard";
import { SettingsFormActions } from "@/components/app/SettingsFormActions";
import DateFormatSelect from "@/tenant/features/settings/components/DateFormatSelect";
import EmailIntegrationPanel from "@/tenant/features/settings/components/EmailIntegrationPanel";
import SmsIntegrationPanel from "@/tenant/features/settings/components/SmsIntegrationPanel";
import WhatsAppIntegrationPanel from "@/tenant/features/settings/components/WhatsAppIntegrationPanel";
import TimezoneSelect from "@/tenant/features/settings/components/TimezoneSelect";
import { GlobalSettingsSecuritySection } from "@/tenant/features/settings/components/GlobalSettingsSecuritySection";
import { SettingsAdminOnlyNotice } from "@/tenant/features/settings/components/SettingsAdminOnlyNotice";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import {
  SettingsCallout,
  SettingsFieldGroup,
  SettingsPanel,
  SettingsToggleRow,
} from "@/components/app/SettingsShell";

/**
 * Regional preferences (everyone), notifications and security (admin only).
 * Visual theming lives in ThemeSettings (`/settings/theme`).
 */
export default function GlobalSettings(): React.JSX.Element {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canWriteGlobal = can("settings.global.write");

  const { data, isGlobalDirty, saved, saving, upd, handleSaveGlobal, handleDiscardGlobal } =
    useSettingsGlobalDraft();

  return (
    <SettingsPanel
      width="narrow"
      introKey="settings.introGlobal"
      isDirty={isGlobalDirty}
      saved={saved}
      footer={
        <SettingsFormActions
          saveLabel={t("global.saveSettings")}
          savingLabel={t("global.saving")}
          onSave={handleSaveGlobal}
          onDiscard={handleDiscardGlobal}
          discardLabel={t("theme.discardChanges")}
          dirty={isGlobalDirty}
          saving={saving}
          saved={saved}
        />
      }
    >
      <SectionCard
        title={t("global.regionalTitle")}
        subtitle={t("global.regionalDesc")}
        icon={Languages}
      >
        <SettingsFieldGroup>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="language">{t("global.language")}</Label>
            <FormSelect
              id="language"
              name="language"
              value={data.language}
              onChange={(next) => {
                upd("language", next as AppLanguageCode);
              }}
              options={APP_LANGUAGES.map((lang) => ({
                value: lang.code,
                label: formatLanguageSelectLabel(lang),
              }))}
            />
            <p className="text-xs text-muted-foreground">
              {isRtlLanguage(data.language) ? t("global.rtlLayout") : t("global.ltrLayout")}
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="timezone">{t("global.timezone")}</Label>
            <TimezoneSelect
              id="timezone"
              value={data.timezone}
              onChange={(v) =>
                upd("timezone", normalizeTimezone(v, DEFAULT_GLOBAL_SETTINGS.timezone))
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="dateFormat">{t("global.dateFormat")}</Label>
            <DateFormatSelect
              id="dateFormat"
              value={data.dateFormat}
              language={data.language}
              onChange={(v) =>
                upd(
                  "dateFormat",
                  normalizeDateFormat(v, DEFAULT_GLOBAL_SETTINGS.dateFormat as DateFormatId),
                )
              }
            />
            <p className="text-xs text-muted-foreground">{t("global.dateFormatNote")}</p>
          </div>
        </SettingsFieldGroup>
        <div className="mt-4">
          <SettingsCallout>{t("global.timezoneNote")}</SettingsCallout>
        </div>
      </SectionCard>

      {canWriteGlobal ? (
        <>
          <SectionCard
            title={t("global.notifications")}
            subtitle={t("global.notificationsDesc")}
            icon={Bell}
          >
            <div className="space-y-3">
              <SettingsCallout>{t("global.notificationsNote")}</SettingsCallout>
              <div
                className="flex flex-wrap items-center gap-2 text-xs font-medium"
                aria-live="polite"
              >
                <span className="text-muted-foreground">
                  {t("global.notificationsActiveChannel")}:
                </span>
                {(() => {
                  const activeChannels = getActiveNotificationChannels(data);
                  if (activeChannels.length === 0) {
                    return (
                      <Badge as="span" tone="warning" size="sm">
                        {t("global.notificationsChannelNone")}
                      </Badge>
                    );
                  }
                  return activeChannels.map((ch) => (
                    <Badge key={ch} as="span" tone="primary" size="sm">
                      {ch === "email" && t("global.notificationsChannelEmail")}
                      {ch === "sms" && t("global.notificationsChannelSms")}
                      {ch === "whatsapp" && t("global.notificationsChannelWhatsApp")}
                    </Badge>
                  ));
                })()}
              </div>
              <SettingsToggleRow
                id="emailNotifications"
                label={t("global.emailNotifications")}
                description={t("global.emailNotificationsDesc")}
                checked={Boolean(data.emailNotifications)}
                onCheckedChange={(v) => upd("emailNotifications", v)}
              />
              {data.emailNotifications ? <EmailIntegrationPanel /> : null}
              <SettingsToggleRow
                id="smsNotifications"
                label={t("global.smsNotifications")}
                description={t("global.smsNotificationsDesc")}
                checked={Boolean(data.smsNotifications)}
                onCheckedChange={(v) => upd("smsNotifications", v)}
              />
              {data.smsNotifications ? <SmsIntegrationPanel /> : null}
              <SettingsToggleRow
                id="whatsAppNotifications"
                label={t("global.whatsAppNotifications")}
                description={t("global.whatsAppNotificationsDesc")}
                checked={Boolean(data.whatsAppNotifications)}
                onCheckedChange={(v) => upd("whatsAppNotifications", v)}
              />
              {data.whatsAppNotifications ? <WhatsAppIntegrationPanel /> : null}
            </div>
          </SectionCard>

          <GlobalSettingsSecuritySection data={data} upd={upd} />
        </>
      ) : (
        <SettingsAdminOnlyNotice
          titleKey="global.notificationsSecurityAdminOnlyTitle"
          descKey="global.notificationsSecurityAdminOnlyDesc"
        />
      )}
    </SettingsPanel>
  );
}

import React from "react";
import { Languages } from "lucide-react";
import {
  APP_LANGUAGES,
  DEFAULT_GLOBAL_SETTINGS,
  formatLanguageSelectLabel,
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
import TimezoneSelect from "@/tenant/features/settings/components/TimezoneSelect";
import { GlobalSettingsSecuritySection } from "@/tenant/features/settings/components/GlobalSettingsSecuritySection";
import { SettingsAdminOnlyNotice } from "@/tenant/features/settings/components/SettingsAdminOnlyNotice";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { SettingsCallout, SettingsFieldGroup, SettingsPanel } from "@/components/app/SettingsShell";

/**
 * Regional preferences (everyone) and security (admin only).
 * Notification delivery gateways live under Messaging → Setup → Preferences.
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
      footerSticky
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
        <GlobalSettingsSecuritySection data={data} upd={upd} />
      ) : (
        <SettingsAdminOnlyNotice
          titleKey="global.notificationsSecurityAdminOnlyTitle"
          descKey="global.notificationsSecurityAdminOnlyDesc"
        />
      )}
    </SettingsPanel>
  );
}

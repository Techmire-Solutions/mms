import React from "react";
import { Mail } from "lucide-react";
import { type AppTranslationKey, type EmailProviderId } from "@mms/shared";
import { FormSelect } from "@/components/app/FormSelect";
import { Input, Label } from "@shared/ui";
import { PasswordInput } from "@/components/app/PasswordInput";
import { IntegrationPanelChrome } from "@/components/app/IntegrationPanelChrome";
import { useEmailIntegrationPanel } from "@/tenant/features/settings/hooks/useEmailIntegrationPanel";

/**
 * Multi-provider SMTP setup (Gmail, Microsoft 365, Outlook, Yahoo, iCloud, Zoho, custom).
 * Only mounted by the parent while Email Notifications is enabled.
 */
export default function EmailIntegrationPanel(): React.JSX.Element {
  const {
    t,
    providers,
    loading,
    saving,
    testing,
    form,
    smtpPassword,
    setSmtpPassword,
    selectedPreset,
    isCustom,
    setField,
    handleSave,
    handleTest,
  } = useEmailIntegrationPanel();

  return (
    <IntegrationPanelChrome
      icon={Mail}
      title={t("email.integrationTitle")}
      description={t("email.integrationDesc")}
      calloutText={t("email.separateSaveNote")}
      connected={form.connected}
      lastTestOk={form.lastTestOk}
      statusConnectedText={t("email.statusConnected")}
      statusNotConnectedText={t("email.statusNotConnected")}
      loading={loading}
      lastError={form.lastError}
      saving={saving}
      testing={testing}
      saveLabel={t("email.saveConnection")}
      testLabel={t("email.sendTest")}
      onSave={() => void handleSave()}
      onTest={() => void handleTest()}
    >
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="email-provider">{t("email.provider")}</Label>
        <FormSelect
          id="email-provider"
          name="providerId"
          value={form.providerId}
          onChange={(v) => setField("providerId", v as EmailProviderId)}
          options={providers.map((preset) => ({
            value: preset.id,
            label: t(preset.labelKey as AppTranslationKey),
          }))}
        />
        <p className="text-xs text-muted-foreground">
          {t(selectedPreset.hintKey as AppTranslationKey)}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email-from-name">{t("email.fromName")}</Label>
        <Input
          id="email-from-name"
          name="fromName"
          value={form.fromName}
          onChange={(event) => setField("fromName", event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-from-address">{t("email.fromAddress")}</Label>
        <Input
          id="email-from-address"
          name="fromAddress"
          type="email"
          value={form.fromAddress}
          onChange={(event) => setField("fromAddress", event.target.value)}
          placeholder={`admin@${selectedPreset.exampleDomain}`}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="email-smtp-username">{t("email.smtpUsername")}</Label>
        <Input
          id="email-smtp-username"
          name="smtpUsername"
          value={form.smtpUsername}
          onChange={(event) => setField("smtpUsername", event.target.value)}
          placeholder={`you@${selectedPreset.exampleDomain}`}
          autoComplete="username"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="email-smtp-password">{t("email.smtpPassword")}</Label>
        <PasswordInput
          id="email-smtp-password"
          name="emailSmtpPassword"
          value={smtpPassword}
          onChange={(event) => setSmtpPassword(event.target.value)}
          placeholder={
            form.hasCredentials
              ? t("email.smtpPasswordPlaceholderSaved")
              : t("email.smtpPasswordPlaceholder")
          }
          autoComplete="new-password"
        />
      </div>

      {isCustom && (
        <>
          <div className="space-y-2">
            <Label htmlFor="email-smtp-host">{t("email.smtpHost")}</Label>
            <Input
              id="email-smtp-host"
              name="smtpHost"
              value={form.smtpHost ?? ""}
              onChange={(event) => setField("smtpHost", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-smtp-port">{t("email.smtpPort")}</Label>
            <Input
              id="email-smtp-port"
              name="smtpPort"
              type="text"
              inputMode="numeric"
              min={1}
              max={65535}
              value={form.smtpPort ?? 587}
              onChange={(event) => setField("smtpPort", Number(event.target.value))}
            />
          </div>
        </>
      )}
    </IntegrationPanelChrome>
  );
}

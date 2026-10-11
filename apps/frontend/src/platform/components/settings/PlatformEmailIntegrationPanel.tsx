import React from "react";
import { Mail } from "lucide-react";
import { type AppTranslationKey, type EmailProviderId } from "@mms/shared";
import { FormSelect } from "@/components/ui/FormSelect";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Label } from "@/components/ui/label";
import { PlatformIntegrationPanelChrome } from "@/platform/components/settings/PlatformIntegrationPanelChrome";
import { usePlatformEmailIntegrationPanel } from "@/platform/components/settings/usePlatformEmailIntegrationPanel";

/**
 * Multi-provider SMTP setup for platform apex email (2FA codes, admin alerts).
 * Only mounted while Email Notifications is enabled.
 */
export function PlatformEmailIntegrationPanel(): React.JSX.Element {
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
  } = usePlatformEmailIntegrationPanel();

  return (
    <PlatformIntegrationPanelChrome
      icon={Mail}
      title={t("email.integrationTitle")}
      description={t("platformEmail.integrationDesc")}
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
        <Label htmlFor="platform-email-provider">{t("email.provider")}</Label>
        <FormSelect
          id="platform-email-provider"
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
        <Label htmlFor="platform-email-from-name">{t("email.fromName")}</Label>
        <Input
          id="platform-email-from-name"
          name="fromName"
          value={form.fromName}
          onChange={(event) => setField("fromName", event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="platform-email-from-address">{t("email.fromAddress")}</Label>
        <Input
          id="platform-email-from-address"
          name="fromAddress"
          type="email"
          value={form.fromAddress}
          onChange={(event) => setField("fromAddress", event.target.value)}
          placeholder={`admin@${selectedPreset.exampleDomain}`}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="platform-email-smtp-username">{t("email.smtpUsername")}</Label>
        <Input
          id="platform-email-smtp-username"
          name="smtpUsername"
          value={form.smtpUsername}
          onChange={(event) => setField("smtpUsername", event.target.value)}
          placeholder={`you@${selectedPreset.exampleDomain}`}
          autoComplete="username"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="platform-email-smtp-password">{t("email.smtpPassword")}</Label>
        <PasswordInput
          id="platform-email-smtp-password"
          name="platformEmailSmtpPassword"
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
            <Label htmlFor="platform-email-smtp-host">{t("email.smtpHost")}</Label>
            <Input
              id="platform-email-smtp-host"
              name="smtpHost"
              value={form.smtpHost ?? ""}
              onChange={(event) => setField("smtpHost", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform-email-smtp-port">{t("email.smtpPort")}</Label>
            <Input
              id="platform-email-smtp-port"
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
    </PlatformIntegrationPanelChrome>
  );
}

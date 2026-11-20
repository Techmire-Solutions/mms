import React from "react";
import { Mail } from "lucide-react";
import { type AppTranslationKey, type EmailProviderId } from "@mms/shared";
import { FormSelect } from "@/components/app/FormSelect";
import { Input, IntegrationPanelChrome, Label } from "@shared/ui";
import { PasswordInput } from "@/components/app/PasswordInput";
import { useEmailIntegrationPanel } from "../hooks/useEmailIntegrationPanel";

/**
 * Multi-provider SMTP setup (Gmail, Microsoft 365, Outlook, Yahoo, iCloud, Zoho, custom).
 * Only mounted by the parent while Email Notifications is enabled.
 */
export default function EmailIntegrationPanel({
  canWrite = true,
}: {
  canWrite?: boolean;
}): React.JSX.Element {
  const {
    t,
    providers,
    loading,
    saving,
    testing,
    actionError,
    form,
    smtpPassword,
    setSmtpPassword,
    testEmail,
    setTestEmail,
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
      lastError={actionError ?? form.lastError}
      saving={saving}
      testing={testing}
      saveDisabled={!canWrite}
      testDisabled={!canWrite}
      saveLabel={t("email.saveConnection")}
      testLabel={t("email.sendTest")}
      onSave={() => void handleSave()}
      onTest={() => void handleTest()}
      footerContent={
        <div className="space-y-2">
          <Label htmlFor="email-test-email">{t("email.testEmailPlaceholder")}</Label>
          <Input
            id="email-test-email"
            name="testEmail"
            type="email"
            value={testEmail}
            onChange={(event) => setTestEmail(event.target.value)}
            placeholder={`admin@${selectedPreset.exampleDomain}`}
            disabled={!canWrite}
          />
        </div>
      }
    >
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="email-provider">{t("email.provider")}</Label>
        <FormSelect
          id="email-provider"
          name="providerId"
          value={form.providerId}
          onChange={(v) => setField("providerId", v as EmailProviderId)}
          disabled={!canWrite}
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
          disabled={!canWrite}
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
          disabled={!canWrite}
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
          disabled={!canWrite}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="email-smtp-password">{t("email.smtpPassword")}</Label>
        <PasswordInput
          id="email-smtp-password"
          name="emailSmtpPassword"
          value={smtpPassword}
          onChange={(event) => setSmtpPassword(event.target.value)}
          disabled={!canWrite}
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
              disabled={!canWrite}
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
              disabled={!canWrite}
            />
          </div>
        </>
      )}
    </IntegrationPanelChrome>
  );
}

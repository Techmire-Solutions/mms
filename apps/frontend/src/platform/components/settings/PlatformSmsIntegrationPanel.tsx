import React from "react";
import { MessageSquare } from "lucide-react";
import { type AppTranslationKey, type SmsProviderId } from "@mms/shared";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/app/PasswordInput";
import { Label } from "@/components/ui/label";
import { PlatformIntegrationPanelChrome } from "@/platform/components/settings/PlatformIntegrationPanelChrome";
import { usePlatformSmsIntegrationPanel } from "@/platform/components/settings/usePlatformSmsIntegrationPanel";

/** One active SMS provider at a time, for platform apex 2FA/alerts. */
export function PlatformSmsIntegrationPanel(): React.JSX.Element {
  const {
    t,
    providers,
    loading,
    saving,
    testing,
    form,
    accountSecret,
    setAccountSecret,
    testPhone,
    setTestPhone,
    selectedPreset,
    setField,
    handleSave,
    handleTest,
  } = usePlatformSmsIntegrationPanel();

  return (
    <PlatformIntegrationPanelChrome
      icon={MessageSquare}
      title={t("sms.integrationTitle")}
      description={t("platformSms.integrationDesc")}
      calloutText={t("sms.separateSaveNote")}
      connected={form.connected}
      lastTestOk={form.lastTestOk}
      statusConnectedText={t("sms.statusConnected")}
      statusNotConnectedText={t("sms.statusNotConnected")}
      loading={loading}
      lastError={form.lastError}
      saving={saving}
      testing={testing}
      testDisabled={!testPhone.trim()}
      saveLabel={t("sms.saveConnection")}
      testLabel={t("sms.sendTest")}
      onSave={() => void handleSave()}
      onTest={() => void handleTest()}
      footerContent={
        <div className="space-y-2">
          <Label htmlFor="platform-sms-test-phone">{t("sms.testPhonePlaceholder")}</Label>
          <Input
            id="platform-sms-test-phone"
            name="testPhone"
            type="tel"
            value={testPhone}
            onChange={(event) => setTestPhone(event.target.value)}
            placeholder="+923001234567"
          />
        </div>
      }
    >
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="platform-sms-provider">{t("sms.provider")}</Label>
        <FormSelect
          id="platform-sms-provider"
          name="providerId"
          value={form.providerId}
          onChange={(v) => setField("providerId", v as SmsProviderId)}
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
        <Label htmlFor="platform-sms-account-id">{t("sms.accountId")}</Label>
        <Input
          id="platform-sms-account-id"
          name="accountId"
          value={form.accountId}
          onChange={(event) => setField("accountId", event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="platform-sms-sender-id">{t("sms.senderId")}</Label>
        <Input
          id="platform-sms-sender-id"
          name="senderId"
          value={form.senderId}
          onChange={(event) => setField("senderId", event.target.value)}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="platform-sms-account-secret">{t("sms.accountSecret")}</Label>
        <PasswordInput
          id="platform-sms-account-secret"
          name="platformSmsAccountSecret"
          value={accountSecret}
          onChange={(event) => setAccountSecret(event.target.value)}
          placeholder={
            form.hasCredentials
              ? t("sms.accountSecretPlaceholderSaved")
              : t("sms.accountSecretPlaceholder")
          }
          autoComplete="new-password"
        />
      </div>

      {selectedPreset.requiresBaseUrl && (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="platform-sms-api-base-url">{t("sms.apiBaseUrl")}</Label>
          <Input
            id="platform-sms-api-base-url"
            name="apiBaseUrl"
            value={form.apiBaseUrl ?? ""}
            onChange={(event) => setField("apiBaseUrl", event.target.value)}
            placeholder={selectedPreset.baseUrlPlaceholder}
          />
        </div>
      )}
    </PlatformIntegrationPanelChrome>
  );
}

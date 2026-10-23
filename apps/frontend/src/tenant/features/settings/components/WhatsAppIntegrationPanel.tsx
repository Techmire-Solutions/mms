import React from "react";
import { MessageCircle } from "lucide-react";
import { type AppTranslationKey, type WhatsappProviderId } from "@mms/shared";
import { FormSelect } from "@/components/app/FormSelect";
import { Input, IntegrationPanelChrome, Label } from "@shared/ui";
import { PasswordInput } from "@/components/app/PasswordInput";
import { useWhatsAppIntegrationPanel } from "@/tenant/features/settings/hooks/useWhatsAppIntegrationPanel";

/**
 * Multi-provider WhatsApp Business setup (Meta Cloud API, Twilio, Infobip).
 * Only mounted by parent while WhatsApp Notifications is enabled.
 */
export default function WhatsAppIntegrationPanel(): React.JSX.Element {
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
  } = useWhatsAppIntegrationPanel();

  return (
    <IntegrationPanelChrome
      icon={MessageCircle}
      title={t("whatsapp.integrationTitle")}
      description={t("whatsapp.integrationDesc")}
      calloutText={t("whatsapp.separateSaveNote")}
      connected={form.connected}
      lastTestOk={form.lastTestOk}
      statusConnectedText={t("whatsapp.statusConnected")}
      statusNotConnectedText={t("whatsapp.statusNotConnected")}
      loading={loading}
      lastError={form.lastError}
      saving={saving}
      testing={testing}
      saveLabel={t("whatsapp.saveConnection")}
      testLabel={t("whatsapp.sendTest")}
      onSave={() => void handleSave()}
      onTest={() => void handleTest()}
      footerContent={
        <div className="space-y-2">
          <Label htmlFor="whatsapp-test-phone">{t("whatsapp.testPhonePlaceholder")}</Label>
          <Input
            id="whatsapp-test-phone"
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
        <Label htmlFor="whatsapp-provider">{t("whatsapp.provider")}</Label>
        <FormSelect
          id="whatsapp-provider"
          name="providerId"
          value={form.providerId}
          onChange={(v) => setField("providerId", v as WhatsappProviderId)}
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
        <Label htmlFor="whatsapp-account-id">{t("whatsapp.accountId")}</Label>
        <Input
          id="whatsapp-account-id"
          name="accountId"
          value={form.accountId}
          onChange={(event) => setField("accountId", event.target.value)}
          placeholder={t("whatsapp.accountIdPlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="whatsapp-sender-id">{t("whatsapp.senderId")}</Label>
        <Input
          id="whatsapp-sender-id"
          name="senderId"
          value={form.senderId}
          onChange={(event) => setField("senderId", event.target.value)}
          placeholder={selectedPreset.senderPlaceholder}
        />
      </div>

      {selectedPreset.requiresPhoneNumberId && (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="whatsapp-phone-number-id">{t("whatsapp.phoneNumberId")}</Label>
          <Input
            id="whatsapp-phone-number-id"
            name="phoneNumberId"
            value={form.phoneNumberId ?? ""}
            onChange={(event) => setField("phoneNumberId", event.target.value)}
            placeholder={t("whatsapp.phoneNumberIdPlaceholder")}
          />
        </div>
      )}

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="whatsapp-account-secret">{t("whatsapp.accountSecret")}</Label>
        <PasswordInput
          id="whatsapp-account-secret"
          name="whatsappAccountSecret"
          value={accountSecret}
          onChange={(event) => setAccountSecret(event.target.value)}
          placeholder={
            form.hasCredentials
              ? t("whatsapp.accountSecretPlaceholderSaved")
              : t("whatsapp.accountSecretPlaceholder")
          }
          autoComplete="new-password"
        />
      </div>

      {selectedPreset.requiresBaseUrl && (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="whatsapp-api-base-url">{t("whatsapp.apiBaseUrl")}</Label>
          <Input
            id="whatsapp-api-base-url"
            name="apiBaseUrl"
            value={form.apiBaseUrl ?? ""}
            onChange={(event) => setField("apiBaseUrl", event.target.value)}
            placeholder={selectedPreset.baseUrlPlaceholder}
          />
        </div>
      )}
    </IntegrationPanelChrome>
  );
}

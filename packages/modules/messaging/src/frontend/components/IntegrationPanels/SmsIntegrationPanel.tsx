import React from "react";
import { MessageSquare } from "lucide-react";
import { type AppTranslationKey, type SmsProviderId } from "@mms/contracts";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { PasswordInput } from "@mms/fe-core/components/PasswordInput";
import { Input, IntegrationPanelChrome, Label } from "@mms/ui";
import {
  useSmsIntegrationPanel,
  type SmsIntegrationPanelHookOptions,
} from "./useSmsIntegrationPanel";

export interface SmsIntegrationPanelProps extends SmsIntegrationPanelHookOptions {
  /** Field id prefix — platform passes `"platform-"` for `platform-sms-*` ids. */
  idPrefix?: string;
  /** Panel description key — `platformSms.integrationDesc` on apex. */
  descriptionKey?: AppTranslationKey;
  /** Read-only mode gates save/test and disables every input (tenant). */
  canWrite?: boolean;
  /** Console-specific test-button gating (platform requires a test phone). */
  disableTest?: (testPhone: string) => boolean;
  /** `name` attribute for the secret input (console-specific). */
  secretFieldName?: string;
}

/**
 * One-active-provider SMS setup panel (SSOT) shared by the Tenant and Platform
 * consoles. Console-specific API, i18n description, ids, and write gating are
 * props; validation comes from `@mms/contracts`.
 */
export function SmsIntegrationPanel({
  api,
  idPrefix = "",
  descriptionKey = "sms.integrationDesc",
  canWrite = true,
  disableTest,
  secretFieldName = "smsAccountSecret",
  seedTestTarget,
  prepareSaveConfig,
  resolveTestTarget,
  testTargetRequiredKey,
  validateTestTarget,
  resolveActionError,
  onConfigSaved,
}: SmsIntegrationPanelProps): React.JSX.Element {
  const {
    t,
    providers,
    loading,
    saving,
    testing,
    actionError,
    form,
    accountSecret,
    setAccountSecret,
    testPhone,
    setTestPhone,
    selectedPreset,
    setField,
    handleSave,
    handleTest,
  } = useSmsIntegrationPanel({
    api,
    seedTestTarget,
    prepareSaveConfig,
    resolveTestTarget,
    testTargetRequiredKey,
    validateTestTarget,
    resolveActionError,
    onConfigSaved,
  });

  return (
    <IntegrationPanelChrome
      icon={MessageSquare}
      title={t("sms.integrationTitle")}
      description={t(descriptionKey)}
      calloutText={t("sms.separateSaveNote")}
      connected={form.connected}
      lastTestOk={form.lastTestOk}
      statusConnectedText={t("sms.statusConnected")}
      statusNotConnectedText={t("sms.statusNotConnected")}
      loading={loading}
      lastError={actionError ?? form.lastError}
      saving={saving}
      testing={testing}
      saveDisabled={!canWrite}
      testDisabled={disableTest ? disableTest(testPhone) : !canWrite}
      saveLabel={t("sms.saveConnection")}
      testLabel={t("sms.sendTest")}
      onSave={() => void handleSave()}
      onTest={() => void handleTest()}
      footerContent={
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}sms-test-phone`}>{t("sms.testPhonePlaceholder")}</Label>
          <Input
            id={`${idPrefix}sms-test-phone`}
            name="testPhone"
            type="tel"
            value={testPhone}
            onChange={(event) => setTestPhone(event.target.value)}
            placeholder="+923001234567"
            disabled={!canWrite}
          />
        </div>
      }
    >
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}sms-provider`}>{t("sms.provider")}</Label>
        <FormSelect
          id={`${idPrefix}sms-provider`}
          name="providerId"
          value={form.providerId}
          onChange={(v) => setField("providerId", v as SmsProviderId)}
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
        <Label htmlFor={`${idPrefix}sms-account-id`}>{t("sms.accountId")}</Label>
        <Input
          id={`${idPrefix}sms-account-id`}
          name="accountId"
          value={form.accountId}
          onChange={(event) => setField("accountId", event.target.value)}
          disabled={!canWrite}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}sms-sender-id`}>{t("sms.senderId")}</Label>
        <Input
          id={`${idPrefix}sms-sender-id`}
          name="senderId"
          value={form.senderId}
          onChange={(event) => setField("senderId", event.target.value)}
          disabled={!canWrite}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}sms-account-secret`}>{t("sms.accountSecret")}</Label>
        <PasswordInput
          id={`${idPrefix}sms-account-secret`}
          name={secretFieldName}
          value={accountSecret}
          onChange={(event) => setAccountSecret(event.target.value)}
          disabled={!canWrite}
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
          <Label htmlFor={`${idPrefix}sms-api-base-url`}>{t("sms.apiBaseUrl")}</Label>
          <Input
            id={`${idPrefix}sms-api-base-url`}
            name="apiBaseUrl"
            value={form.apiBaseUrl ?? ""}
            onChange={(event) => setField("apiBaseUrl", event.target.value)}
            placeholder={selectedPreset.baseUrlPlaceholder}
            disabled={!canWrite}
          />
        </div>
      )}
    </IntegrationPanelChrome>
  );
}

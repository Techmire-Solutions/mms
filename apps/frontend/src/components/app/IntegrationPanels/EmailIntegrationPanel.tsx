import React from "react";
import { Mail } from "lucide-react";
import { type AppTranslationKey, type EmailProviderId } from "@mms/contracts";
import { FormSelect } from "@/components/app/FormSelect";
import { PasswordInput } from "@/components/app/PasswordInput";
import { Input, IntegrationPanelChrome, Label } from "@mms/ui";
import {
  useEmailIntegrationPanel,
  type EmailIntegrationPanelHookOptions,
} from "./useEmailIntegrationPanel";

export interface EmailIntegrationPanelProps extends EmailIntegrationPanelHookOptions {
  /** Field id prefix — platform passes `"platform-"` for `platform-email-*` ids. */
  idPrefix?: string;
  /** Panel description key — `platformEmail.integrationDesc` on apex. */
  descriptionKey?: AppTranslationKey;
  /** Read-only mode gates save/test and disables every input (tenant). */
  canWrite?: boolean;
  /** Tenant renders the test-email footer input. */
  showTestTargetInput?: boolean;
  /** `name` attribute for the password input (console-specific). */
  secretFieldName?: string;
}

/**
 * Multi-provider SMTP setup panel (SSOT) shared by the Tenant and Platform
 * consoles. Console-specific API, i18n description, ids, and write gating are
 * props; validation comes from `@mms/contracts`.
 */
export function EmailIntegrationPanel({
  api,
  idPrefix = "",
  descriptionKey = "email.integrationDesc",
  canWrite = true,
  showTestTargetInput = false,
  secretFieldName = "emailSmtpPassword",
  seedTestTarget,
  resolveTestTarget,
  resolveActionError,
  onConfigSaved,
}: EmailIntegrationPanelProps): React.JSX.Element {
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
    testTarget,
    setTestTarget,
    selectedPreset,
    isCustom,
    setField,
    handleSave,
    handleTest,
  } = useEmailIntegrationPanel({
    api,
    seedTestTarget,
    resolveTestTarget,
    resolveActionError,
    onConfigSaved,
  });

  return (
    <IntegrationPanelChrome
      icon={Mail}
      title={t("email.integrationTitle")}
      description={t(descriptionKey)}
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
        showTestTargetInput ? (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}email-test-email`}>{t("email.testEmailPlaceholder")}</Label>
            <Input
              id={`${idPrefix}email-test-email`}
              name="testEmail"
              type="email"
              value={testTarget}
              onChange={(event) => setTestTarget(event.target.value)}
              placeholder={`admin@${selectedPreset.exampleDomain}`}
              disabled={!canWrite}
            />
          </div>
        ) : undefined
      }
    >
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}email-provider`}>{t("email.provider")}</Label>
        <FormSelect
          id={`${idPrefix}email-provider`}
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
        <Label htmlFor={`${idPrefix}email-from-name`}>{t("email.fromName")}</Label>
        <Input
          id={`${idPrefix}email-from-name`}
          name="fromName"
          value={form.fromName ?? ""}
          onChange={(event) => setField("fromName", event.target.value)}
          disabled={!canWrite}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}email-from-address`}>{t("email.fromAddress")}</Label>
        <Input
          id={`${idPrefix}email-from-address`}
          name="fromAddress"
          type="email"
          value={form.fromAddress ?? ""}
          onChange={(event) => setField("fromAddress", event.target.value)}
          placeholder={`admin@${selectedPreset.exampleDomain}`}
          disabled={!canWrite}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}email-smtp-username`}>{t("email.smtpUsername")}</Label>
        <Input
          id={`${idPrefix}email-smtp-username`}
          name="smtpUsername"
          value={form.smtpUsername ?? ""}
          onChange={(event) => setField("smtpUsername", event.target.value)}
          placeholder={`you@${selectedPreset.exampleDomain}`}
          autoComplete="username"
          disabled={!canWrite}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}email-smtp-password`}>{t("email.smtpPassword")}</Label>
        <PasswordInput
          id={`${idPrefix}email-smtp-password`}
          name={secretFieldName}
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
            <Label htmlFor={`${idPrefix}email-smtp-host`}>{t("email.smtpHost")}</Label>
            <Input
              id={`${idPrefix}email-smtp-host`}
              name="smtpHost"
              value={form.smtpHost ?? ""}
              onChange={(event) => setField("smtpHost", event.target.value)}
              disabled={!canWrite}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}email-smtp-port`}>{t("email.smtpPort")}</Label>
            <Input
              id={`${idPrefix}email-smtp-port`}
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

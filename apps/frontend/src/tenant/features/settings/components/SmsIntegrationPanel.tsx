import React from "react";
import { Loader2, MessageSquare, PlugZap } from "lucide-react";
import { type AppTranslationKey, type SmsProviderId } from "@mms/shared";
import { FormSelect } from "@/components/ui/FormSelect";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldErrorMessage } from "@/components/ui/FormField";
import { SettingsCallout } from "@/components/ui/SettingsShell";
import { useSmsIntegrationPanel } from "@/tenant/features/settings/components/useSmsIntegrationPanel";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

/**
 * One active provider at a time — Twilio, Vonage, MSG91, Infobip, or Telesign.
 * Only mounted by the parent while SMS Notifications is enabled.
 */
export default function SmsIntegrationPanel(): React.JSX.Element {
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
  } = useSmsIntegrationPanel();

  if (loading) {
    return (
      <div className={cn(WORK_SURFACE_INNER, "space-y-4 p-4")} aria-busy="true">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-10 w-full rounded-lg sm:col-span-2" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(WORK_SURFACE_INNER, "space-y-4 p-4")}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <MessageSquare className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{t("sms.integrationTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("sms.integrationDesc")}</p>
        </div>
        {form.connected && form.lastTestOk ? (
          <Badge as="span" tone="success" size="sm">
            {t("sms.statusConnected")}
          </Badge>
        ) : (
          <Badge as="span" tone="muted" size="sm">
            {t("sms.statusNotConnected")}
          </Badge>
        )}
      </div>

      <SettingsCallout variant="info">{t("sms.separateSaveNote")}</SettingsCallout>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="sms-provider">{t("sms.provider")}</Label>
          <FormSelect
            id="sms-provider"
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
          <Label htmlFor="sms-account-id">{t("sms.accountId")}</Label>
          <Input
            id="sms-account-id"
            name="accountId"
            value={form.accountId}
            onChange={(event) => setField("accountId", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sms-sender-id">{t("sms.senderId")}</Label>
          <Input
            id="sms-sender-id"
            name="senderId"
            value={form.senderId}
            onChange={(event) => setField("senderId", event.target.value)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="sms-account-secret">{t("sms.accountSecret")}</Label>
          <PasswordInput
            id="sms-account-secret"
            name="smsAccountSecret"
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
            <Label htmlFor="sms-api-base-url">{t("sms.apiBaseUrl")}</Label>
            <Input
              id="sms-api-base-url"
              name="apiBaseUrl"
              value={form.apiBaseUrl ?? ""}
              onChange={(event) => setField("apiBaseUrl", event.target.value)}
              placeholder={selectedPreset.baseUrlPlaceholder}
            />
          </div>
        )}
      </div>

      {form.lastError && !form.lastTestOk ? <FieldErrorMessage message={form.lastError} /> : null}

      <div className="space-y-2">
        <Label htmlFor="sms-test-phone">{t("sms.testPhonePlaceholder")}</Label>
        <Input
          id="sms-test-phone"
          name="testPhone"
          type="tel"
          value={testPhone}
          onChange={(event) => setTestPhone(event.target.value)}
          placeholder="+923001234567"
        />
      </div>

      <div className="flex flex-wrap gap-2.5 pt-1">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || testing}
          className="min-h-11 gap-2 px-4 shadow-sm"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <PlugZap className="h-4 w-4" aria-hidden />
          )}
          <span>{t("sms.saveConnection")}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleTest()}
          disabled={saving || testing || !testPhone.trim()}
          className="min-h-11 gap-2 px-4"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          <span>{t("sms.sendTest")}</span>
        </Button>
      </div>
    </div>
  );
}

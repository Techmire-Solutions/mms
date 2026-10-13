import React from "react";
import { Loader2, Mail, PlugZap } from "lucide-react";
import { type AppTranslationKey, type EmailProviderId } from "@mms/shared";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/app/PasswordInput";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldErrorMessage } from "@/components/app/FormField";
import { SettingsCallout } from "@/components/app/SettingsShell";
import { useEmailIntegrationPanel } from "@/tenant/features/settings/hooks/useEmailIntegrationPanel";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

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
          <Mail className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{t("email.integrationTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("email.integrationDesc")}</p>
        </div>
        {form.connected && form.lastTestOk ? (
          <Badge as="span" tone="success" size="sm">
            {t("email.statusConnected")}
          </Badge>
        ) : (
          <Badge as="span" tone="muted" size="sm">
            {t("email.statusNotConnected")}
          </Badge>
        )}
      </div>

      <SettingsCallout variant="info">{t("email.separateSaveNote")}</SettingsCallout>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </div>

      {form.lastError && !form.lastTestOk ? <FieldErrorMessage message={form.lastError} /> : null}

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
          <span>{t("email.saveConnection")}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleTest()}
          disabled={saving || testing}
          className="min-h-11 gap-2 px-4"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          <span>{t("email.sendTest")}</span>
        </Button>
      </div>
    </div>
  );
}

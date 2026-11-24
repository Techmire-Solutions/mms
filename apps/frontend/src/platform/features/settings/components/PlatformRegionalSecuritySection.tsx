import React, { useState } from "react";
import { Clock, KeyRound, Languages, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Field } from "@/components/app/FormPrimitives";
import { SectionCard } from "@/components/app/SectionCard";
import { Alert } from "@/components/app/Alert";
import { Badge, Button, CardSkeleton, Input, ToggleRow } from "@mms/ui";
import DateFormatSelect from "@/components/app/DateFormatSelect";
import TimezoneSelect from "@/components/app/TimezoneSelect";
import {
  usePlatformSettingsQuery,
  useUpdatePlatformSettings,
} from "@/platform/features/settings/hooks/usePlatformSettings";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";
import { PLATFORM_IDLE_SESSION_TIMEOUT_MINUTES, type DateFormatId } from "@mms/contracts";

/** Regional display defaults + the enforceable apex session policy. */
export function PlatformRegionalSecuritySection(): React.JSX.Element {
  const { t } = useTranslation();
  const { data: settings, isLoading, isError, refetch } = usePlatformSettingsQuery();
  const updateSettings = useUpdatePlatformSettings();

  const [timezone, setTimezone] = useState("UTC");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [idleMinutes, setIdleMinutes] = useState(PLATFORM_IDLE_SESSION_TIMEOUT_MINUTES);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [prevSettings, setPrevSettings] = useState(settings);

  const isDirty =
    Boolean(settings) &&
    (timezone !== (settings?.timezone ?? "UTC") ||
      dateFormat !== (settings?.dateFormat ?? "DD/MM/YYYY") ||
      idleMinutes !== (settings?.idleSessionMinutes ?? PLATFORM_IDLE_SESSION_TIMEOUT_MINUTES));

  if (settings !== prevSettings) {
    setPrevSettings(settings);
    if (settings && !isDirty) {
      setTimezone(settings.timezone);
      setDateFormat(settings.dateFormat);
      setIdleMinutes(settings.idleSessionMinutes);
    }
  }

  if (isLoading) return <CardSkeleton count={2} />;
  if (isError) {
    return (
      <Alert
        tone="destructive"
        role="alert"
        description={t("platform.loadFailedHint")}
        action={
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  const handleSave = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await updateSettings.mutateAsync({
        timezone,
        dateFormat: dateFormat as DateFormatId,
        idleSessionMinutes: Math.min(Math.max(Math.round(idleMinutes), 5), 480),
      });
    } catch (error) {
      setFormError(getPlatformErrorMessage(error, t, undefined, "platform.loadFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title={t("platform.settings.regionalTitle")}
        subtitle={t("platform.settings.regionalDesc")}
        icon={Languages}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="platform-timezone" label={t("global.timezone")}>
            <TimezoneSelect id="platform-timezone" value={timezone} onChange={setTimezone} />
          </Field>
          <Field id="platform-date-format" label={t("global.dateFormat")}>
            <DateFormatSelect
              id="platform-date-format"
              value={dateFormat}
              onChange={setDateFormat}
              language="en"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title={t("platform.settings.securityTitle")}
        subtitle={t("platform.settings.securityDesc")}
        icon={ShieldCheck}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/30 p-3.5">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <div className="text-xs font-medium">{t("platform.idleSessionTitle")}</div>
                <div className="text-3xs text-muted-foreground">
                  {t("platform.settings.idleSessionHint")}
                </div>
              </div>
            </div>
            <Input
              type="number"
              min={5}
              max={480}
              value={idleMinutes}
              disabled={saving}
              onChange={(event) => setIdleMinutes(Number(event.target.value))}
              className="h-9 w-24 rounded-xl text-center font-mono text-xs"
              aria-label={t("platform.idleSessionTitle")}
            />
          </div>

          <ToggleRow
            id="platform-2fa-enforced"
            variant="bordered"
            label={t("platform.stepUpEnforcedTitle")}
            description={t("platform.stepUpEnforcedDesc")}
            checked
            disabled
            onCheckedChange={() => undefined}
            ariaLabel={t("platform.stepUpEnforcedTitle")}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/30 p-3.5">
            <div className="flex items-center gap-3">
              <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <div className="text-xs font-medium">{t("platform.settings.twoFactorTitle")}</div>
                <div className="text-3xs text-muted-foreground">
                  {t("platform.settings.twoFactorDesc")}
                </div>
              </div>
            </div>
            <Badge as="span" tone="success" size="sm">
              {t("platform.enforced")}
            </Badge>
          </div>
        </div>
      </SectionCard>

      {formError ? (
        <Alert tone="destructive" density="compact" role="alert" description={formError} />
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={!isDirty || saving}
          className="min-h-11 rounded-xl px-5 font-semibold"
        >
          {saving ? t("common.loading") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}

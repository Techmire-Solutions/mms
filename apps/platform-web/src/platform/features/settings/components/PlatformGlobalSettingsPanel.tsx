import React, { useState } from "react";
import { Globe, Save } from "lucide-react";
import { useTranslation } from "@mms/fe-core/i18n";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { Alert } from "@/components/app/Alert";
import {
  usePlatformSettingsQuery,
  useUpdatePlatformSettings,
} from "@/platform/features/settings/hooks/usePlatformSettings";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  ToggleRow,
  ErrorState,
  CardSkeleton,
} from "@mms/ui";

export function PlatformGlobalSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const { data: settings, isLoading, isError, refetch } = usePlatformSettingsQuery();
  const updateSettings = useUpdatePlatformSettings();

  const [syncTls, setSyncTls] = useState(true);
  const [tlsExtraSans, setTlsExtraSans] = useState("");
  const [certbotEmail, setCertbotEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [prevSettings, setPrevSettings] = useState(settings);

  const isDirty =
    Boolean(settings) &&
    (syncTls !== (settings?.syncTlsOnCreate ?? true) ||
      tlsExtraSans !== (settings?.tlsExtraSans ?? "") ||
      certbotEmail !== (settings?.certbotEmail ?? ""));

  // Re-seed only while the draft is pristine: a background refetch must not
  // overwrite unsaved TLS/email edits.
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    if (settings && !isDirty) {
      setSyncTls(settings.syncTlsOnCreate ?? true);
      setTlsExtraSans(settings.tlsExtraSans ?? "");
      setCertbotEmail(settings.certbotEmail ?? "");
    }
  }

  if (isLoading) return <CardSkeleton count={2} />;

  if (isError) {
    return (
      <ErrorState
        title={t("platform.loadFailed")}
        description={t("platform.loadFailedHint")}
        onRetry={() => void refetch()}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    const email = certbotEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError(t("platform.validationEnterValidEmail"));
      return;
    }
    const sans = tlsExtraSans
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const invalidSan = sans.find((value) => !/^[a-z0-9.*-]+$/i.test(value));
    if (invalidSan) {
      setFormError(t("platform.settings.tlsExtraSansHint"));
      return;
    }
    setSaving(true);
    try {
      await updateSettings.mutateAsync({
        syncTlsOnCreate: syncTls,
        tlsExtraSans: sans.join(", "),
        certbotEmail: email,
      });
    } catch (error) {
      setFormError(getPlatformErrorMessage(error, t, undefined, "platform.loadFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-start">
      <Card className="rounded-xl border-border/60 shadow-xs">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            {t("platform.settings.tlsTitle")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t("platform.settings.tlsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            id="sync-tls"
            variant="bordered"
            label={t("platform.settings.syncTlsLabel")}
            description={t("platform.settings.syncTlsDesc")}
            checked={syncTls}
            disabled={saving}
            onCheckedChange={setSyncTls}
            ariaLabel={t("platform.settings.syncTlsAria")}
          />

          <Field
            id="certbot-email"
            label={t("platform.settings.certbotEmailLabel")}
            hint={t("platform.settings.certbotEmailHint")}
          >
            <Input
              id="certbot-email"
              type="email"
              value={certbotEmail}
              disabled={saving}
              onChange={(e) => setCertbotEmail(e.target.value)}
              placeholder={t("platform.settings.certbotEmailPlaceholder")}
              className="h-10 rounded-xl"
            />
          </Field>

          <Field
            id="tls-extra-sans"
            label={t("platform.settings.tlsExtraSansLabel")}
            hint={t("platform.settings.tlsExtraSansHint")}
          >
            <Input
              id="tls-extra-sans"
              value={tlsExtraSans}
              disabled={saving}
              onChange={(e) => setTlsExtraSans(e.target.value)}
              placeholder={t("platform.settings.tlsExtraSansPlaceholder")}
              className="h-10 rounded-xl font-mono text-xs"
            />
          </Field>

          {formError ? (
            <Alert tone="destructive" density="compact" role="alert" description={formError} />
          ) : null}

          <div className="pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-xl px-5 font-semibold cursor-pointer"
            >
              <Save className="w-4 h-4 me-2" />
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

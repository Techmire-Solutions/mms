import React, { useState } from "react";
import { Globe, Save } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  usePlatformSettingsQuery,
  useUpdatePlatformSettings,
} from "@/platform/hooks/usePlatformSettings";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  ToggleRow,
  Label,
  ErrorState,
  CardSkeleton,
} from "@shared/ui";

export function PlatformGlobalSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const { data: settings, isLoading, isError, refetch } = usePlatformSettingsQuery();
  const updateSettings = useUpdatePlatformSettings();

  const [syncTls, setSyncTls] = useState(true);
  const [tlsExtraSans, setTlsExtraSans] = useState("");
  const [certbotEmail, setCertbotEmail] = useState("");
  // Re-seed the editable form during render whenever the query data changes.
  const [prevSettings, setPrevSettings] = useState(settings);
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    if (settings) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate({
      syncTlsOnCreate: syncTls,
      tlsExtraSans,
      certbotEmail,
    });
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
            onCheckedChange={setSyncTls}
            ariaLabel={t("platform.settings.syncTlsAria")}
          />

          <div className="space-y-1.5">
            <Label htmlFor="certbot-email" className="text-xs font-medium text-foreground">
              {t("platform.settings.certbotEmailLabel")}
            </Label>
            <Input
              id="certbot-email"
              type="email"
              value={certbotEmail}
              onChange={(e) => setCertbotEmail(e.target.value)}
              placeholder="admin@example.com"
              className="h-10 rounded-xl"
            />
            <p className="text-3xs text-muted-foreground">
              {t("platform.settings.certbotEmailHint")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tls-extra-sans" className="text-xs font-medium text-foreground">
              {t("platform.settings.tlsExtraSansLabel")}
            </Label>
            <Input
              id="tls-extra-sans"
              value={tlsExtraSans}
              onChange={(e) => setTlsExtraSans(e.target.value)}
              placeholder="apex.example.com, admin.example.com"
              className="h-10 rounded-xl font-mono text-xs"
            />
            <p className="text-3xs text-muted-foreground">
              {t("platform.settings.tlsExtraSansHint")}
            </p>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={updateSettings.isPending}
              className="min-h-11 rounded-xl px-5 font-semibold cursor-pointer"
            >
              <Save className="w-4 h-4 me-2" />
              {updateSettings.isPending ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

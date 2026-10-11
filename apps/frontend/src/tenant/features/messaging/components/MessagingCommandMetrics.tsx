import { Send } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";
import { ErrorState } from "@/components/ui/ErrorState";
import { ModuleCommandMetricsGrid } from "@/components/ui/ModuleCommandMetricsGrid";
import { useTranslation } from "@/hooks/useTranslation";
import { MESSAGING_CHANNEL_CONFIG } from "../config";

interface MessagingCommandMetricsProps {
  canRead: boolean;
  isError: boolean;
  onRetry: () => void;
  stats: {
    total: number;
    sms: number;
    whatsapp: number;
    email: number;
  };
}

export function MessagingCommandMetrics({
  canRead,
  isError,
  onRetry,
  stats,
}: MessagingCommandMetricsProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (!canRead) return null;

  if (isError) {
    return (
      <ErrorState
        title={t("messaging.loadFailed")}
        description={t("messaging.loadFailedHint")}
        onRetry={onRetry}
      />
    );
  }

  return (
    <ModuleCommandMetricsGrid
      items={[
        {
          icon: Send,
          label: t("messaging.stats.total"),
          value: stats.total,
          accent: "primary",
        },
        ...Object.values(MESSAGING_CHANNEL_CONFIG).map((config) => ({
          icon: config.icon,
          label: t(config.labelStatsKey as AppTranslationKey),
          value: stats[config.id as keyof typeof stats],
          accent: config.themeAccent,
        })),
      ]}
    />
  );
}

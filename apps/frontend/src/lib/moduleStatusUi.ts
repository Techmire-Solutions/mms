import { toTitleCase, type AppTranslationKey } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import type { AccentColor } from "@/components/ui/statCardAccent";

export type StatusTranslate = (key: AppTranslationKey) => string;

/**
 * Shared module status UI trio — localized label (with Title Case fallback),
 * configured option list, and StatusBadge config. Module adapters
 * (Teachers/Students) supply the translation prefix, status resolver, and tones.
 */
export function createModuleStatusUi(options: {
  translationPrefix: string;
  resolveStatuses: (statuses?: readonly string[] | null) => readonly string[];
  toneForStatus: (status: string) => string;
  metricAccentForStatus?: (status: string) => AccentColor;
}) {
  const { translationPrefix, resolveStatuses, toneForStatus, metricAccentForStatus } = options;

  function statusLabel(t: StatusTranslate, status: string): string {
    const key = `${translationPrefix}.${status}` as AppTranslationKey;
    const translated = t(key);
    return translated === key ? toTitleCase(status) : translated;
  }

  function statusOptions(
    t: StatusTranslate,
    statuses?: readonly string[],
  ): Array<{ value: string; label: string }> {
    return resolveStatuses(statuses).map((status) => ({
      value: status,
      label: statusLabel(t, status),
    }));
  }

  function statusBadgeConfig(
    t: StatusTranslate,
    statuses?: readonly string[],
  ): Record<string, StatusBadgeConfigItem> {
    const configByStatus: Record<string, StatusBadgeConfigItem> = {};
    for (const statusValue of resolveStatuses(statuses)) {
      configByStatus[statusValue] = {
        label: statusLabel(t, statusValue),
        cls: toneForStatus(statusValue),
      };
    }
    return configByStatus;
  }

  function statusMetricAccent(status: string): AccentColor {
    return metricAccentForStatus ? metricAccentForStatus(status) : "muted";
  }

  return { statusLabel, statusOptions, statusBadgeConfig, statusMetricAccent };
}

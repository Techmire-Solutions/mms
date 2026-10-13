import type { AppTranslationKey } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";

export interface ExaminationStatusLabels {
  upcoming: string;
  ongoing: string;
  completed: string;
  scheduled: string;
  cancelled: string;
}

export function resolveExaminationStatusLabels(
  t: (key: AppTranslationKey) => string,
): ExaminationStatusLabels {
  return {
    upcoming: t("examinations.status.upcoming"),
    ongoing: t("examinations.status.ongoing"),
    completed: t("examinations.status.completed"),
    scheduled: t("examinations.status.scheduled"),
    cancelled: t("examinations.status.cancelled"),
  };
}

export function resolveExaminationStatusConfig(
  labels: ExaminationStatusLabels,
): Record<string, StatusBadgeConfigItem> {
  return {
    upcoming: { label: labels.upcoming, cls: SEMANTIC_BADGE.info },
    ongoing: { label: labels.ongoing, cls: SEMANTIC_BADGE.warning },
    completed: { label: labels.completed, cls: SEMANTIC_BADGE.success },
    scheduled: { label: labels.scheduled, cls: "bg-primary/10 text-primary border-primary/20" },
    cancelled: { label: labels.cancelled, cls: SEMANTIC_BADGE.muted },
  };
}

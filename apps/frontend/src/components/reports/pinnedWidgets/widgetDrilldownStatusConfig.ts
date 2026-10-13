import type { AppTranslationKey } from "@mms/shared";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";

type TranslateFn = (key: AppTranslationKey, args?: Record<string, string | number>) => string;

export function buildWidgetDrilldownStatusConfig(t: TranslateFn) {
  return {
    active: { label: t("reports.status.active"), cls: SEMANTIC_BADGE.success },
    paid: { label: t("reports.status.paid"), cls: SEMANTIC_BADGE.success },
    present: { label: t("reports.status.present"), cls: SEMANTIC_BADGE.success },
    customer: { label: t("reports.status.customer"), cls: SEMANTIC_BADGE.success },
    inactive: { label: t("reports.status.inactive"), cls: SEMANTIC_BADGE.destructive },
    unpaid: { label: t("reports.status.unpaid"), cls: SEMANTIC_BADGE.destructive },
    absent: { label: t("reports.status.absent"), cls: SEMANTIC_BADGE.destructive },
    lead: { label: t("reports.status.lead"), cls: SEMANTIC_BADGE.destructive },
    cancelled: { label: t("reports.status.cancelled"), cls: SEMANTIC_BADGE.destructive },
  };
}

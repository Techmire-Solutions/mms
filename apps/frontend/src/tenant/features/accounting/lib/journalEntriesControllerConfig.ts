import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export function buildJournalStatusConfig(
  t: TranslationFunction,
): Record<string, StatusBadgeConfigItem> {
  return {
    posted: { label: t("accounting.journal.status.posted"), cls: SEMANTIC_BADGE.successStrong },
    draft: { label: t("accounting.journal.status.draft"), cls: SEMANTIC_BADGE.warningStrong },
  };
}

export function buildJournalSubTabs(t: TranslationFunction) {
  return [
    { key: "transactions" as const, label: t("accounting.journal.tabs.transactions") },
    { key: "cashbook" as const, label: t("accounting.journal.tabs.cashbook") },
  ];
}

export function buildJournalModeTabs(t: TranslationFunction) {
  return [
    { key: "simple" as const, label: t("accounting.journal.dashboard.simple") },
    { key: "advanced" as const, label: t("accounting.journal.dashboard.advanced") },
  ];
}

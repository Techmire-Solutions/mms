import { type AppTranslationKey, toTitleCase } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import { SESSION_TYPES } from "@/lib/data/sessionsData";

const SESSION_TYPE_LABEL_KEYS: Record<string, AppTranslationKey> = {
  Hifz: "sessions.types.hifz",
  Qaidah: "sessions.types.qaidah",
  Tajweed: "sessions.types.tajweed",
  "Islamic Studies": "sessions.types.islamicStudies",
  Arabic: "sessions.types.arabic",
};

const SESSION_TYPE_BADGE_CLS: Record<string, string> = {
  Hifz: SEMANTIC_BADGE.successStrong,
  Qaidah: SEMANTIC_BADGE.infoStrong,
  Tajweed: "bg-primary/15 text-primary border-primary/20",
  "Islamic Studies": SEMANTIC_BADGE.warningStrong,
  Arabic: SEMANTIC_BADGE.secondary,
};

interface UseSessionDisplayConfigParams {
  statuses: string[];
  types: string[];
  t: TranslationFunction;
}

export function useSessionDisplayConfig({ statuses, types, t }: UseSessionDisplayConfigParams) {
  const statusOptions = (() => {
    return statuses.length > 0 ? statuses : ["active", "upcoming", "completed", "cancelled"];
  })();
  const typeOptions = (() => {
    return types.length > 0 ? types : [...SESSION_TYPES];
  })();

  const statusLabels = (() => {
    const sessionStatusLabelsByValue: Record<string, string> = {};
    for (const statusOption of statusOptions) {
      const translationKey = `sessions.status.${statusOption}` as AppTranslationKey;
      const translated = t(translationKey);
      sessionStatusLabelsByValue[statusOption] =
        translated === translationKey ? toTitleCase(statusOption) : translated;
    }
    return sessionStatusLabelsByValue;
  })();

  const typeLabels = (() => {
    const sessionTypeLabelsByValue: Record<string, string> = {};
    for (const typeOption of typeOptions) {
      const translationKey = SESSION_TYPE_LABEL_KEYS[typeOption];
      sessionTypeLabelsByValue[typeOption] = translationKey ? t(translationKey) : typeOption;
    }
    return sessionTypeLabelsByValue;
  })();

  const statusConfig = (() => ({
    active: { label: statusLabels.active, cls: SEMANTIC_BADGE.success },
    upcoming: { label: statusLabels.upcoming, cls: SEMANTIC_BADGE.info },
    completed: { label: statusLabels.completed, cls: SEMANTIC_BADGE.muted },
    cancelled: { label: statusLabels.cancelled, cls: SEMANTIC_BADGE.destructive },
  }))() as Record<string, StatusBadgeConfigItem>;

  const typeConfig = (() => {
    const config: Record<string, StatusBadgeConfigItem> = {};
    for (const [typeValue, label] of Object.entries(typeLabels)) {
      config[typeValue] = {
        label,
        cls: SESSION_TYPE_BADGE_CLS[typeValue] ?? SEMANTIC_BADGE.muted,
      };
    }
    return config;
  })() as Record<string, StatusBadgeConfigItem>;

  return {
    statusOptions,
    typeOptions,
    statusLabels,
    typeLabels,
    statusConfig,
    typeConfig,
  };
}

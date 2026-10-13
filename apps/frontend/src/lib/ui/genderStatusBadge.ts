import type { AppTranslationKey } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { genderBadgeClass, SEMANTIC_BADGE } from "@/lib/ui/semanticTone";

type Translate = (key: AppTranslationKey) => string;

/**
 * Shared StatusBadge config for male/female(/any) — SSOT for sessions + enrollments.
 */
export function genderStatusBadgeConfig(
  t: Translate,
  options?: { includeAny?: boolean },
): Record<string, StatusBadgeConfigItem> {
  const config: Record<string, StatusBadgeConfigItem> = {
    male: {
      label: t("sessions.classes.gender.male"),
      cls: genderBadgeClass("male"),
    },
    female: {
      label: t("sessions.classes.gender.female"),
      cls: genderBadgeClass("female"),
    },
  };
  if (options?.includeAny) {
    config.any = {
      label: t("sessions.classes.gender.any"),
      cls: SEMANTIC_BADGE.muted,
    };
  }
  return config;
}

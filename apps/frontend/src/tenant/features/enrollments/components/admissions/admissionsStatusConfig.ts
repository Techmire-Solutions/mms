import type { RegistrationApplicationStatus } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";

/** Badge label + tone per application status (label always paired with colour). */
export function admissionsStatusConfig(
  t: TranslationFunction,
): Record<RegistrationApplicationStatus, StatusBadgeConfigItem> {
  return {
    submitted: { label: t("enrollments.admissions.status.submitted"), cls: SEMANTIC_BADGE.info },
    under_review: {
      label: t("enrollments.admissions.status.under_review"),
      cls: SEMANTIC_BADGE.warning,
    },
    waitlisted: { label: t("enrollments.admissions.status.waitlisted"), cls: SEMANTIC_BADGE.muted },
    approved: { label: t("enrollments.admissions.status.approved"), cls: SEMANTIC_BADGE.success },
    rejected: {
      label: t("enrollments.admissions.status.rejected"),
      cls: SEMANTIC_BADGE.destructive,
    },
    withdrawn: { label: t("enrollments.admissions.status.withdrawn"), cls: SEMANTIC_BADGE.muted },
  };
}

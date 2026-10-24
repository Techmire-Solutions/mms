import type { AppTranslationKey, EnrollmentStatus } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";

type Translate = (key: AppTranslationKey) => string;

const STATUS_TONE: Record<EnrollmentStatus, string> = {
  pending: SEMANTIC_BADGE.warning,
  confirmed: SEMANTIC_BADGE.success,
  cancelled: SEMANTIC_BADGE.destructive,
  completed: SEMANTIC_BADGE.info,
  withdrawn: SEMANTIC_BADGE.muted,
  promoted: SEMANTIC_BADGE.info,
  retained: SEMANTIC_BADGE.warning,
  graduated: SEMANTIC_BADGE.success,
  left: SEMANTIC_BADGE.muted,
};

const STATUS_LABEL: Record<EnrollmentStatus, AppTranslationKey> = {
  pending: "enrollments.status.pending",
  confirmed: "enrollments.status.confirmed",
  cancelled: "enrollments.status.cancelled",
  completed: "enrollments.status.completed",
  withdrawn: "enrollments.status.withdrawn",
  promoted: "enrollments.status.promoted",
  retained: "enrollments.status.retained",
  graduated: "enrollments.status.graduated",
  left: "enrollments.status.left",
};

/** Enrollment status labels (SSOT across directory, drawer, reports and charts). */
export function enrollmentStatusLabels(t: Translate): Record<EnrollmentStatus, string> {
  return {
    pending: t(STATUS_LABEL.pending),
    confirmed: t(STATUS_LABEL.confirmed),
    cancelled: t(STATUS_LABEL.cancelled),
    completed: t(STATUS_LABEL.completed),
    withdrawn: t(STATUS_LABEL.withdrawn),
    promoted: t(STATUS_LABEL.promoted),
    retained: t(STATUS_LABEL.retained),
    graduated: t(STATUS_LABEL.graduated),
    left: t(STATUS_LABEL.left),
  };
}

/** StatusBadge config for enrollment statuses. */
export function enrollmentStatusBadgeConfig(t: Translate): Record<string, StatusBadgeConfigItem> {
  const labels = enrollmentStatusLabels(t);
  return Object.fromEntries(
    (Object.keys(STATUS_TONE) as EnrollmentStatus[]).map((status) => [
      status,
      { label: labels[status], cls: STATUS_TONE[status] },
    ]),
  );
}

/** StatusBadge config for enrollment payment statuses. */
export function enrollmentPaymentBadgeConfig(t: Translate): Record<string, StatusBadgeConfigItem> {
  return {
    paid: { label: t("enrollments.payment.paid"), cls: SEMANTIC_BADGE.success },
    pending: { label: t("enrollments.payment.pending"), cls: SEMANTIC_BADGE.warning },
    none: { label: t("enrollments.payment.none"), cls: SEMANTIC_BADGE.muted },
  };
}

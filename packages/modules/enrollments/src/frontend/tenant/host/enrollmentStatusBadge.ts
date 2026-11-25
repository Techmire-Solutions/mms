import { ENROLLMENT_STATUSES, type AppTranslationKey } from "@mms/contracts";
import { getEnrollmentsHost } from "../host.js";

const host = () => (getEnrollmentsHost() as any).enrollmentStatusBadge;
type Translate = (key: AppTranslationKey) => string;

export function enrollmentPaymentBadgeConfig(t: Translate): any {
  const fn = host()?.enrollmentPaymentBadgeConfig;
  if (typeof fn === "function") return fn(t);
  return {
    paid: { label: t("enrollments.payment.paid"), cls: "" },
    pending: { label: t("enrollments.payment.pending"), cls: "" },
    none: { label: t("enrollments.payment.none"), cls: "" },
  };
}

export function enrollmentStatusLabels(t: Translate): any {
  const fn = host()?.enrollmentStatusLabels;
  if (typeof fn === "function") return fn(t);
  return Object.fromEntries(
    ENROLLMENT_STATUSES.map((status) => [
      status,
      t(`enrollments.status.${status}` as AppTranslationKey),
    ]),
  );
}

export function enrollmentStatusBadgeConfig(t: Translate): any {
  const fn = host()?.enrollmentStatusBadgeConfig;
  if (typeof fn === "function") return fn(t);
  const labels = enrollmentStatusLabels(t);
  return Object.fromEntries(
    ENROLLMENT_STATUSES.map((status) => [status, { label: labels[status], cls: "" }]),
  );
}

export const enrollmentStatusBadge = {
  enrollmentPaymentBadgeConfig,
  enrollmentStatusBadgeConfig,
  enrollmentStatusLabels,
};

export default enrollmentStatusBadge;

import type { Enrollment } from "@mms/contracts";
import { EntityArchivedBanner } from "@mms/fe-core/components/DetailDrawerArchiveChrome";
import { useTranslation } from "@mms/fe-core/i18n";

export interface EnrollmentArchivedBannerProps {
  enrollment: Enrollment;
}

/** Soft-delete archive banner for enrollment drawer. */
export function EnrollmentArchivedBanner({
  enrollment,
}: EnrollmentArchivedBannerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  return (
    <EntityArchivedBanner
      deletedAt={enrollment.deletedAt}
      deletionReason={enrollment.deletionReason}
      titleWithDate={(date) => t("enrollments.detail.archivedBanner", { date })}
      reasonLabel={t("enrollments.deletionReasonLabel")}
    />
  );
}

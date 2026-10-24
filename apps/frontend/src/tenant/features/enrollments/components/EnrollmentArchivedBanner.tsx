import type { Enrollment } from "@mms/shared";
import { EntityArchivedBanner } from "@/components/app/DetailDrawerArchiveChrome";
import { useTranslation } from "@/hooks/useTranslation";

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

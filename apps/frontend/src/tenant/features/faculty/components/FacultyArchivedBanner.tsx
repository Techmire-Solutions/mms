import { FACULTY_MODULE_MANIFEST, type Faculty } from "@mms/shared";
import { EntityArchivedBanner } from "@/components/app/DetailDrawerArchiveChrome";
import { useTranslation } from "@/hooks/useTranslation";

export type FacultyArchivedBannerProps = {
  faculty?: Faculty;
};

/** Soft-delete archive banner for faculty drawer and directory cards. */
export function FacultyArchivedBanner({
  faculty,
}: FacultyArchivedBannerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!faculty) return null;
  return (
    <EntityArchivedBanner
      deletedAt={faculty.deletedAt}
      deletionReason={faculty.deletionReason}
      titleWithDate={(date) => t("faculty.detail.archivedBanner", { date })}
      reasonLabel={t("faculty.deletionReasonLabel")}
      retentionDays={
        (faculty as { retentionDays?: number | null }).retentionDays ??
        FACULTY_MODULE_MANIFEST.softDelete?.retentionDays ??
        null
      }
      purgeAfter={(faculty as { purgeAfter?: unknown }).purgeAfter}
    />
  );
}

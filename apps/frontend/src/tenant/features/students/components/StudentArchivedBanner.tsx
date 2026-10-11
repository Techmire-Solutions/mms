import { STUDENTS_MODULE_MANIFEST, type Student } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { EntityArchivedBanner } from "@/components/ui/DetailDrawerArchiveChrome";

/** Soft-delete archive banner for student drawer and directory cards. */
export function StudentArchivedBanner({ student }: { student: Student }): React.JSX.Element | null {
  const { t } = useTranslation();
  return (
    <EntityArchivedBanner
      deletedAt={student.deletedAt}
      deletionReason={student.deletionReason}
      titleWithDate={(date) => t("students.detail.archivedBanner", { date })}
      reasonLabel={t("students.deletionReasonLabel")}
      retentionDays={
        (student as { retentionDays?: number | null }).retentionDays ??
        STUDENTS_MODULE_MANIFEST.softDelete?.retentionDays ??
        null
      }
      purgeAfter={(student as { purgeAfter?: unknown }).purgeAfter}
    />
  );
}

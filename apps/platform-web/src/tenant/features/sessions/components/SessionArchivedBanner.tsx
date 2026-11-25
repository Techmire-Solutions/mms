import { SESSIONS_MODULE_MANIFEST, type Session } from "@mms/contracts";
import { EntityArchivedBanner } from "@mms/fe-core/components/DetailDrawerArchiveChrome";
import { useTranslation } from "@mms/fe-core/i18n";

/** Soft-delete archive banner for session drawer. */
export function SessionArchivedBanner({ session }: { session: Session }): React.JSX.Element | null {
  const { t } = useTranslation();
  return (
    <EntityArchivedBanner
      deletedAt={session.deletedAt}
      deletionReason={session.deletionReason}
      titleWithDate={(date) => t("sessions.detail.archivedBanner", { date })}
      reasonLabel={t("sessions.deletionReasonLabel")}
      retentionDays={
        (session as { retentionDays?: number | null }).retentionDays ??
        SESSIONS_MODULE_MANIFEST.softDelete?.retentionDays ??
        null
      }
      purgeAfter={(session as { purgeAfter?: unknown }).purgeAfter}
    />
  );
}

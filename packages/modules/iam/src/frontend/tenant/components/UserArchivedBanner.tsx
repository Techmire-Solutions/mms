import type { SystemUser } from "@mms/contracts";
import { EntityArchivedBanner } from "@mms/fe-core/components/DetailDrawerArchiveChrome";
import { useTranslation } from "@mms/fe-core/i18n";

/** Soft-delete archive banner for user drawer and directory cards. */
export function UserArchivedBanner({ user }: { user: SystemUser }): React.JSX.Element | null {
  const { t } = useTranslation();
  return (
    <EntityArchivedBanner
      deletedAt={user.deletedAt}
      titleWithDate={(date) => t("users.detail.archivedBanner", { date })}
      reasonLabel={t("users.detail.archivedSubtitle")}
    />
  );
}

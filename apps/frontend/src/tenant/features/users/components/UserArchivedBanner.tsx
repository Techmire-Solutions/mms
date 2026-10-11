import type { SystemUser } from "@mms/shared";
import { EntityArchivedBanner } from "@/components/ui/DetailDrawerArchiveChrome";
import { useTranslation } from "@/hooks/useTranslation";

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

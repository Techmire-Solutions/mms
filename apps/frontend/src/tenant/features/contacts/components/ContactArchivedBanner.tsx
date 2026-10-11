import type React from "react";
import { CONTACTS_MODULE_MANIFEST, type Contact } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { EntityArchivedBanner } from "@/components/ui/DetailDrawerArchiveChrome";

export interface ContactArchivedBannerProps {
  contact: Contact;
}

/** Soft-delete archive banner shared by contact drawer chrome and directory cards. */
export function ContactArchivedBanner({
  contact,
}: ContactArchivedBannerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  return (
    <EntityArchivedBanner
      deletedAt={contact.deletedAt}
      deletionReason={contact.deletionReason}
      titleWithDate={(date) => t("contacts.detail.archivedBanner", { date })}
      reasonLabel={t("contacts.deletionReasonLabel")}
      retentionDays={
        (contact as { retentionDays?: number | null }).retentionDays ??
        CONTACTS_MODULE_MANIFEST.softDelete?.retentionDays ??
        null
      }
      purgeAfter={(contact as { purgeAfter?: unknown }).purgeAfter}
    />
  );
}

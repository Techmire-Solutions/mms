import React from "react";
import { useTranslation } from "@mms/fe-core/i18n";

/** Destructive-tone "Archived" chip shown on soft-deleted catalog rows. */
export function ArchivedBadge(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">
      {t("faculty.detail.archivedSubtitle")}
    </span>
  );
}

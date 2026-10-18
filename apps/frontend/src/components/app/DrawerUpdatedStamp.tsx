import { Clock } from "lucide-react";
import { formatDate, formatRelativeTime } from "@mms/shared";
import { SectionLabel } from "@/components/app/SectionLabel";
import { formatEntityStamp } from "@/lib/formatEntityStamp";
import { useTranslation } from "@/hooks/useTranslation";

export interface DrawerUpdatedStampProps {
  updatedAt?: unknown;
  createdAt?: unknown;
  /** Fully translated label, e.g. t("contacts.detail.updatedLabel"). */
  label: string;
  showRelative?: boolean;
}

/**
 * Detail-drawer "last updated" footer stamp — SSOT for the shared
 * Contacts / Students / Teachers footer markup. Renders null when no stamp.
 */
export function DrawerUpdatedStamp({
  updatedAt,
  createdAt,
  label,
  showRelative = true,
}: DrawerUpdatedStampProps): React.JSX.Element | null {
  const { language } = useTranslation();
  const stamp = formatEntityStamp(updatedAt) || formatEntityStamp(createdAt);
  if (!stamp) return null;

  const dateStr = formatDate(stamp);
  const relativeStr = showRelative ? formatRelativeTime(stamp, language) : "";

  return (
    <SectionLabel as="div" weight="bold" className="flex items-center gap-2">
      <Clock className="w-3 h-3" aria-hidden />
      <span>
        {label} {dateStr}
        {relativeStr ? ` (${relativeStr})` : ""}
      </span>
    </SectionLabel>
  );
}

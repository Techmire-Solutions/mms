import { Clock } from "lucide-react";
import { formatDate } from "@mms/shared";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { formatEntityStamp } from "@/lib/formatEntityStamp";

export interface DrawerUpdatedStampProps {
  updatedAt?: unknown;
  createdAt?: unknown;
  /** Fully translated label, e.g. t("contacts.detail.updatedLabel"). */
  label: string;
}

/**
 * Detail-drawer "last updated" footer stamp — SSOT for the shared
 * Contacts / Students / Teachers footer markup. Renders null when no stamp.
 */
export function DrawerUpdatedStamp({
  updatedAt,
  createdAt,
  label,
}: DrawerUpdatedStampProps): React.JSX.Element | null {
  const stamp = formatEntityStamp(updatedAt) || formatEntityStamp(createdAt);
  if (!stamp) return null;

  return (
    <SectionLabel as="div" weight="bold" className="flex items-center gap-2">
      <Clock className="w-3 h-3" aria-hidden />
      <span>
        {label} {formatDate(stamp)}
      </span>
    </SectionLabel>
  );
}

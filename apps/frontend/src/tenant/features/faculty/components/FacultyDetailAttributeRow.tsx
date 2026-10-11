import type { LucideIcon } from "lucide-react";
import type { JSX, ReactNode } from "react";
import {
  DetailAttributeRow,
  type DetailAttributeRowVariant,
} from "@/components/ui/DetailAttributeRow";

export interface FacultyDetailAttributeRowProps {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: ReactNode;
  variant?: DetailAttributeRowVariant;
}

/** Attribute row for FacultyDetail — callers own empty-value rendering (muted dash). */
export function FacultyDetailAttributeRow({
  icon,
  iconClassName,
  label,
  value,
  variant,
}: FacultyDetailAttributeRowProps): JSX.Element {
  return (
    <DetailAttributeRow
      icon={icon}
      iconClassName={iconClassName}
      label={label}
      value={value}
      variant={variant ?? "list"}
    />
  );
}

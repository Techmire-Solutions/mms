import type React from "react";
import { Tag } from "lucide-react";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";
import { DetailSectionCard, type DetailSectionCardProps } from "@/components/app/DetailSectionCard";
import { getGenderIcon, getGenderIconClass } from "@/lib/ui/genderUi";
import { ICON_MAP } from "./contactDetailStyles";

export interface FieldGroupCardProps {
  group: string;
  fields: { key: string; label: string; type: string }[];
  formatValue: (field: { key: string; type: string }) => string | null;
  /** Raw field values (needed for gender icon SSOT). */
  getRawValue?: (fieldKey: string) => unknown;
  accentColor?: DetailSectionCardProps["accentColor"];
}

export function FieldGroupCard({
  group,
  fields,
  formatValue,
  getRawValue,
  accentColor,
}: FieldGroupCardProps): React.JSX.Element | null {
  const validFields = fields
    .map((f) => ({ field: f, val: formatValue(f) }))
    .filter((item) => Boolean(item.val));
  if (validFields.length === 0) return null;

  return (
    <DetailSectionCard title={group} accentColor={accentColor}>
      {validFields.map(({ field, val }) => {
        const isGender = field.key === "gender";
        const rawGender = isGender ? String(getRawValue?.(field.key) ?? val ?? "") : "";
        const Icon = isGender ? getGenderIcon(rawGender) : ICON_MAP[field.key] || Tag;
        const iconClassName = isGender ? getGenderIconClass(rawGender) : undefined;
        return (
          <DetailAttributeRow
            key={field.key}
            variant="inset"
            icon={Icon}
            label={field.label}
            value={val}
            iconClassName={iconClassName}
          />
        );
      })}
    </DetailSectionCard>
  );
}

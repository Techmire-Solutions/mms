import React from "react";
import { CompactSegmentedControl } from "@/components/ui/CompactSegmentedControl";
import { FormSelect } from "@/components/ui/FormSelect";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface PageSizeOption {
  value: string;
  label: string;
}

export function getStandardPageSizeOptions(
  t: TranslationFunction | ReturnType<typeof useTranslation>["t"],
): PageSizeOption[] {
  return [
    { value: "a4", label: t("reports.builder.formatA4") },
    { value: "letter", label: t("reports.builder.formatLetter") },
    { value: "a3", label: t("reports.builder.formatA3") },
    { value: "legal", label: t("reports.builder.formatLegal") },
  ];
}

export interface ExportPdfSettingsPopoverProps {
  open: boolean;
  orientation: "p" | "l";
  onOrientationChange: (orientation: "p" | "l") => void;
  pageSize: string;
  onPageSizeChange: (pageSize: string) => void;
  placement?: "top" | "bottom";
  idPrefix?: string;
  className?: string;
}

/**
 * Shared PDF export settings popover primitive.
 * Enforces SSOT for orientation selection, page sizes, and popover styling across export tools.
 */
export function ExportPdfSettingsPopover({
  open,
  orientation,
  onOrientationChange,
  pageSize,
  onPageSizeChange,
  placement = "bottom",
  idPrefix = "export",
  className,
}: ExportPdfSettingsPopoverProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!open) return null;

  const pageSizeOptions = getStandardPageSizeOptions(t);
  const positionClass = placement === "top" ? "bottom-full mb-2" : "top-full mt-2";

  return (
    <div
      className={cn(
        "absolute end-0 surface-overlay rounded-xl p-3 z-popover flex flex-col gap-3 min-w-popover-md max-w-full text-start",
        positionClass,
        className,
      )}
    >
      <div className="space-y-1.5">
        <SectionLabel as="label" htmlFor={`${idPrefix}-orientation`} weight="bold">
          {t("reports.export.orientation")}
        </SectionLabel>
        <CompactSegmentedControl
          options={[
            { value: "p", label: t("reports.export.portrait") },
            { value: "l", label: t("reports.export.landscape") },
          ]}
          value={orientation}
          onChange={(val) => onOrientationChange(val as "p" | "l")}
          fill
        />
      </div>
      <div className="space-y-1.5">
        <SectionLabel as="label" htmlFor={`${idPrefix}-page-size`} weight="bold">
          {t("reports.export.pageSize")}
        </SectionLabel>
        <FormSelect
          id={`${idPrefix}-page-size`}
          value={pageSize}
          onChange={onPageSizeChange}
          options={pageSizeOptions}
        />
      </div>
    </div>
  );
}

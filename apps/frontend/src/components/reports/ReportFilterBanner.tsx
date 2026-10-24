import React from "react";
import {
  ActiveFilterBanner,
  type ActiveFilterBannerAction,
  type ActiveFilterBannerChip,
} from "@/components/app/ActiveFilterBanner";

export interface ReportFilterItem {
  key: string;
  label?: string;
  value: string | null | undefined;
  onClear?: () => void;
  clearLabel?: string;
}

export interface ReportFilterBannerProps {
  label?: string;
  filters?: readonly (ReportFilterItem | null | undefined)[];
  onClearAll?: () => void;
  clearAllLabel?: string;
  className?: string;
}

/**
 * Universal active-filter banner for module reporting tabs.
 * Renders active filter chips and individual or bulk clear buttons.
 */
export const ReportFilterBanner = function ReportFilterBanner({
  label,
  filters = [],
  onClearAll,
  clearAllLabel,
}: ReportFilterBannerProps): React.JSX.Element | null {
  const activeFilters = (() =>
    filters.filter((item): item is ReportFilterItem =>
      Boolean(item && item.value && item.value.trim() !== ""),
    ))();

  const chips = (() =>
    activeFilters.map((item) => ({
      key: item.key,
      label: item.label,
      value: item.value as string,
    })))() as ActiveFilterBannerChip[];

  const actions = (() => {
    if (onClearAll && clearAllLabel && activeFilters.length > 1) {
      return [{ key: "clear-all", label: clearAllLabel, onClick: onClearAll }];
    }
    return activeFilters
      .filter((item) => typeof item.onClear === "function")
      .map((item) => ({
        key: item.key,
        label: item.clearLabel || `Clear ${item.label || item.key}`,
        onClick: item.onClear as () => void,
      }));
  })() as ActiveFilterBannerAction[];

  if (chips.length === 0) {
    return null;
  }

  return <ActiveFilterBanner label={label} chips={chips} actions={actions} />;
};

export default ReportFilterBanner;

import type { JSX } from "react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { Button } from "@/components/ui/button";
import { DateRangeFilterBar } from "@/components/app/DateRangeFilterBar";
import { FormSelect } from "@/components/app/FormSelect";
import {
  ModuleFilterDivider,
  ModuleFilterDropdown,
  ModuleFilterRadioGroup,
} from "@/components/app/ModuleFiltersMenuButton";

/** String options from the filter menu narrowed into the safe channel/status unions. */
const toChannel = (value: string): "all" | "sms" | "whatsapp" | "email" =>
  value === "sms" || value === "whatsapp" || value === "email" ? value : "all";

const toStatus = (value: string): "all" | "sent" | "delivered" | "failed" | "skipped" =>
  value === "sent" || value === "delivered" || value === "failed" || value === "skipped"
    ? value
    : "all";

export interface MessagingFiltersMenuButtonProps {
  activeFilterCount: number;
  onClearFilters: () => void;
  channel: string;
  onChannelChange: (val: "all" | "sms" | "whatsapp" | "email") => void;
  channelOptions: Array<{ value: string; label: string }>;
  status: string;
  onStatusChange: (val: "all" | "sent" | "delivered" | "failed" | "skipped") => void;
  statusOptions: Array<{ value: string; label: string }>;
  category: string;
  onCategoryChange: (val: string) => void;
  categoryOptions: Array<{ value: string; label: string }>;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  handlePresetDate: (days: number) => void;
  clearDates: () => void;
  t: TranslationFunction;
}

export function MessagingFiltersMenuButton({
  activeFilterCount,
  onClearFilters,
  channel,
  onChannelChange,
  channelOptions,
  status,
  onStatusChange,
  statusOptions,
  category,
  onCategoryChange,
  categoryOptions,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  handlePresetDate,
  clearDates,
  t,
}: MessagingFiltersMenuButtonProps): JSX.Element {
  return (
    <ModuleFilterDropdown
      label={t("common.filters")}
      activeCount={activeFilterCount}
      clearLabel={t("common.clearFilters")}
      onClear={onClearFilters}
    >
      <ModuleFilterRadioGroup
        label={t("messaging.channel")}
        value={channel}
        onValueChange={(value: string) => onChannelChange(toChannel(value))}
        options={channelOptions}
      />
      <ModuleFilterDivider />
      <ModuleFilterRadioGroup
        label={t("common.status")}
        value={status}
        onValueChange={(value: string) => onStatusChange(toStatus(value))}
        options={statusOptions}
      />
      <ModuleFilterDivider />
      <div className="p-2 space-y-1">
        <label
          htmlFor="messagingCategoryFilter"
          className="text-xs font-semibold text-muted-foreground block"
        >
          {t("messaging.category")}
        </label>
        <FormSelect
          id="messagingCategoryFilter"
          value={category}
          onChange={onCategoryChange}
          options={categoryOptions}
          className="w-full text-xs"
        />
      </div>
      <ModuleFilterDivider />
      <div className="p-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            {t("messaging.dateSent")}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handlePresetDate(0)}
            className="min-h-11 px-3 text-3xs font-medium"
          >
            {t("datePicker.today")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handlePresetDate(7)}
            className="min-h-11 px-3 text-3xs font-medium"
          >
            {t("messaging.datePreset7d")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handlePresetDate(30)}
            className="min-h-11 px-3 text-3xs font-medium"
          >
            {t("messaging.datePreset30d")}
          </Button>
          {(startDate || endDate) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearDates}
              className="min-h-11 px-3 text-3xs font-medium text-muted-foreground hover:text-foreground"
            >
              {t("datePicker.clear")}
            </Button>
          )}
        </div>
        <DateRangeFilterBar
          idPrefix="messaging-work-filter"
          dateFrom={startDate}
          dateTo={endDate}
          onDateFromChange={onStartDateChange}
          onDateToChange={onEndDateChange}
          fromPlaceholder={t("messaging.dateFrom")}
          toPlaceholder={t("messaging.dateTo")}
          pickerClassName="w-full text-xs"
        />
      </div>
    </ModuleFilterDropdown>
  );
}

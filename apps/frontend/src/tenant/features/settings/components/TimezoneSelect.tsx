import React, { useState } from "react";
import { ChevronsUpDown, Loader2, MapPin } from "lucide-react";
import {
  DEFAULT_GLOBAL_SETTINGS,
  detectBrowserTimezone,
  formatTimezoneLabel,
  getTimezoneOptions,
  groupTimezoneOptions,
  normalizeTimezone,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { detectTimezoneFromLocation } from "@/lib/detectTimezoneFromLocation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import {
  filterGroupedTimezones,
  timezoneDetectionErrorKey,
} from "@/tenant/features/settings/lib/timezoneSelectUtils";
import { TimezoneSelectPopoverContent } from "@/tenant/features/settings/components/TimezoneSelectPopoverContent";

interface TimezoneSelectProps {
  id?: string;
  value: string;
  onChange: (timezone: string) => void;
  disabled?: boolean;
}

/**
 * Searchable IANA timezone picker with GPS and device auto-detect.
 */
export default function TimezoneSelect({
  id,
  value,
  onChange,
  disabled = false,
}: TimezoneSelectProps): React.JSX.Element {
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [detecting, setDetecting] = useState(false);

  const normalizedValue = normalizeTimezone(value, DEFAULT_GLOBAL_SETTINGS.timezone);
  const options = (() => getTimezoneOptions(language))();
  const grouped = (() => groupTimezoneOptions(options))();
  const filtered = (() => filterGroupedTimezones(grouped, query))();
  const selectedLabel = formatTimezoneLabel(normalizedValue, language);

  const applyTimezone = (timezone: string, closePopover = false): void => {
    onChange(timezone);
    if (closePopover) {
      setOpen(false);
      setQuery("");
    }
  };

  const applyDeviceTimezone = (): void => {
    applyTimezone(detectBrowserTimezone(), true);
  };

  const handleLocationDetect = async (): Promise<void> => {
    if (detecting || disabled) return;
    setDetecting(true);
    try {
      const result = await detectTimezoneFromLocation();
      if (result.ok) {
        applyTimezone(result.timezone, true);
        const label = formatTimezoneLabel(result.timezone, language);
        notify.success(t("global.timezoneDetectSuccess"), {
          description:
            result.source === "geolocation"
              ? t("global.timezoneDetectSuccessGps", { label })
              : t("global.timezoneDetectSuccessDevice", { label }),
        });
        return;
      }

      const errorKey = timezoneDetectionErrorKey(result.code);
      const useFallback =
        result.code !== "permission_denied" && result.code !== "geolocation_unsupported";

      if (useFallback) {
        applyTimezone(result.fallbackTimezone, true);
        notify.warning(t(errorKey), {
          description: t("global.timezoneDetectFallback", {
            label: formatTimezoneLabel(result.fallbackTimezone, language),
          }),
        });
      } else {
        notify.error(t(errorKey), {
          description: t("global.timezoneDetectDeniedHint"),
        });
      }
    } finally {
      setDetecting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean): void => {
    setOpen(isOpen);
    if (!isOpen) setQuery("");
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={t("global.timezone")}
            disabled={disabled}
            className={cn(
              "h-auto min-h-11 w-full justify-between px-3 py-2 font-normal sm:flex-1",
              !normalizedValue && "text-muted-foreground",
            )}
          >
            <span className="truncate text-start text-sm">{selectedLabel}</span>
            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <TimezoneSelectPopoverContent
          t={t}
          language={language}
          normalizedValue={normalizedValue}
          query={query}
          setQuery={setQuery}
          detecting={detecting}
          filtered={filtered}
          onLocationDetect={handleLocationDetect}
          onDeviceTimezone={applyDeviceTimezone}
          onSelectTimezone={(timezone) => applyTimezone(timezone, true)}
        />
      </Popover>

      <Button
        type="button"
        variant="outline"
        disabled={disabled || detecting}
        onClick={() => void handleLocationDetect()}
        className="min-h-11 shrink-0 gap-2 px-3.5"
        aria-label={t("global.timezoneDetectLocation")}
      >
        {detecting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <MapPin className="h-4 w-4" aria-hidden />
        )}
        <span>
          {detecting ? t("global.timezoneDetecting") : t("global.timezoneDetectLocation")}
        </span>
      </Button>
    </div>
  );
}

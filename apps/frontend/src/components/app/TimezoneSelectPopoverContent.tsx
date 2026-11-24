import React from "react";
import { Check, Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PopoverContent } from "@/components/ui/popover";

interface TimezoneSelectPopoverContentProps {
  t: TranslationFunction;
  language: string;
  normalizedValue: string;
  query: string;
  setQuery: (query: string) => void;
  detecting: boolean;
  filtered: ReturnType<typeof import("@mms/shared").groupTimezoneOptions>;
  onLocationDetect: () => Promise<void>;
  onDeviceTimezone: () => void;
  onSelectTimezone: (timezone: string) => void;
}

export function TimezoneSelectPopoverContent({
  t,
  language: _language,
  normalizedValue,
  query,
  setQuery,
  detecting,
  filtered,
  onLocationDetect,
  onDeviceTimezone,
  onSelectTimezone,
}: TimezoneSelectPopoverContentProps): React.JSX.Element {
  return (
    <PopoverContent className="w-popover-wide p-0 shadow-surface-lg" align="start">
      <div className="flex items-center border-b border-border/80 px-3 py-1 bg-muted/20">
        <Search className="me-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("global.timezoneSearch")}
          className="h-9 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0 focus-visible:outline-none placeholder:text-muted-foreground"
          aria-label={t("global.timezoneSearch")}
        />
      </div>
      <div
        className="max-h-popover-scroll overflow-y-auto p-1.5 space-y-1"
        role="listbox"
        aria-label={t("global.timezone")}
      >
        <div className="grid grid-cols-1 gap-1 pb-1 border-b border-border/50">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full justify-start items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => void onLocationDetect()}
            disabled={detecting}
          >
            {detecting ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" aria-hidden />
            ) : (
              <MapPin className="h-4 w-4 text-primary shrink-0" aria-hidden />
            )}
            <span className="truncate">
              {detecting ? t("global.timezoneDetecting") : t("global.timezoneDetectLocation")}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full justify-start items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={onDeviceTimezone}
          >
            <LocateFixed className="h-4 w-4 text-primary shrink-0" aria-hidden />
            <span className="truncate">{t("global.timezoneUseDevice")}</span>
          </Button>
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {t("global.timezoneNoResults")}
          </p>
        ) : (
          filtered.map(({ region, options: regionOptions }) => (
            <div key={region} className="pt-1">
              <p className="px-2.5 py-1 text-3xs font-bold uppercase tracking-wider text-muted-foreground">
                {region}
              </p>
              {regionOptions.map((timezoneOption) => {
                const isSelected = normalizedValue === timezoneOption.value;
                return (
                  <Button
                    key={timezoneOption.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    variant="ghost"
                    className={cn(
                      "min-h-11 w-full justify-start items-center gap-2 rounded-lg px-2.5 py-2 text-start font-normal transition-colors hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-accent/80 font-medium text-accent-foreground",
                    )}
                    onClick={() => onSelectTimezone(timezoneOption.value)}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isSelected ? "opacity-100 text-primary" : "opacity-0",
                      )}
                      aria-hidden
                    />
                    <span className="truncate text-xs">{timezoneOption.label}</span>
                    <span className="ms-auto ps-2 font-mono text-3xs text-muted-foreground">
                      {timezoneOption.value}
                    </span>
                  </Button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </PopoverContent>
  );
}

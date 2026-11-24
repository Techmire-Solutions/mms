import React, { useState } from "react";
import { Check, ChevronsUpDown, Languages } from "lucide-react";
import {
  DEFAULT_GLOBAL_SETTINGS,
  detectLocaleDateFormat,
  getDateFormatOptions,
  normalizeDateFormat,
  type AppLanguageCode,
  type AppTranslationKey,
  type DateFormatId,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateFormatSelectProps {
  id?: string;
  value: string;
  onChange: (format: string) => void;
  language: AppLanguageCode;
  disabled?: boolean;
}

/**
 * Date format picker with live samples and locale-based auto-detect.
 */
export default function DateFormatSelect({
  id,
  value,
  onChange,
  language,
  disabled = false,
}: DateFormatSelectProps): React.JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const normalizedValue = normalizeDateFormat(
    value,
    DEFAULT_GLOBAL_SETTINGS.dateFormat as DateFormatId,
  );
  const options = (() => getDateFormatOptions(language))();
  const selected =
    options.find((dateFormatOption) => dateFormatOption.value === normalizedValue) ?? options[0];

  const applyLocaleFormat = (): void => {
    const detected = detectLocaleDateFormat(language);
    onChange(detected);
    setOpen(false);
    const sample =
      options.find((dateFormatOption) => dateFormatOption.value === detected)?.sample ?? detected;
    notify.success(t("global.dateFormatMatchSuccess"), {
      description: t("global.dateFormatMatchSuccessDesc", { pattern: detected, sample }),
    });
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={t("global.dateFormat")}
            disabled={disabled}
            className={cn("h-auto min-h-11 w-full justify-between px-3 py-2 font-normal sm:flex-1")}
          >
            <span className="truncate text-start text-sm">
              <span className="font-mono">{selected.pattern}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-muted-foreground">{selected.sample}</span>
            </span>
            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-popover-md p-1 shadow-surface-lg" align="start">
          <div
            className="max-h-popover-scroll-sm overflow-y-auto"
            role="listbox"
            aria-label={t("global.dateFormat")}
          >
            {options.map((dateFormatOption) => {
              const isSelected = normalizedValue === dateFormatOption.value;
              return (
                <Button
                  key={dateFormatOption.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  variant="ghost"
                  className={cn(
                    "min-h-11 h-auto w-full justify-start items-start gap-2 rounded-lg px-2.5 py-2 text-start font-normal transition-colors hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent/80 font-medium text-accent-foreground",
                  )}
                  onClick={() => {
                    onChange(dateFormatOption.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      isSelected ? "opacity-100 text-primary" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs font-semibold">
                      {dateFormatOption.pattern}
                    </span>
                    <span className="block text-muted-foreground text-start text-xs">
                      {dateFormatOption.sample}
                    </span>
                    <span className="block text-start text-3xs text-muted-foreground">
                      {t(dateFormatOption.hintKey as AppTranslationKey)}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={applyLocaleFormat}
        className="min-h-11 shrink-0 gap-2 px-3.5"
        aria-label={t("global.dateFormatMatchLanguage")}
      >
        <Languages className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span>{t("global.dateFormatMatchLanguage")}</span>
      </Button>
    </div>
  );
}

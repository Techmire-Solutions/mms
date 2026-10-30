/**
 * ThemeModeSelector — Theme setting page display-mode picker.
 *
 * Token-exemption notice:
 * The mini-window preview divs intentionally use raw Tailwind palette classes
 * (zinc-*, white, amber-500, sky-400) to visually represent how the UI looks in
 * light / dark / system mode regardless of the currently active brand token set.
 * Replacing them with semantic tokens (bg-surface, text-foreground) would make
 * all three swatches look identical — defeating their purpose.
 */
import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_MODE_OPTIONS, type ThemeMode } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const MODE_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

interface ThemeModeSelectorProps {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

/**
 * Light / dark / system display mode — single control surface (Theme settings only).
 */
export default function ThemeModeSelector({
  value,
  onChange,
}: ThemeModeSelectorProps): React.JSX.Element {
  const { t } = useTranslation();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const currentIndex = THEME_MODE_OPTIONS.findIndex((opt) => opt.value === value);
    if (currentIndex === -1) return;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % THEME_MODE_OPTIONS.length;
      onChange(THEME_MODE_OPTIONS[nextIndex]!.value);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + THEME_MODE_OPTIONS.length) % THEME_MODE_OPTIONS.length;
      onChange(THEME_MODE_OPTIONS[prevIndex]!.value);
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(THEME_MODE_OPTIONS[0]!.value);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(THEME_MODE_OPTIONS[THEME_MODE_OPTIONS.length - 1]!.value);
    }
  };

  const getSubLabel = (mode: ThemeMode): string => {
    if (mode === "light") return t("theme.displayModeLightDesc");
    if (mode === "dark") return t("theme.displayModeDarkDesc");
    return t("theme.displayModeSystemDesc");
  };

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      role="radiogroup"
      aria-label={t("theme.displayModeTitle")}
      onKeyDown={handleKeyDown}
    >
      {THEME_MODE_OPTIONS.map(({ value: mode, labelKey }) => {
        const Icon = MODE_ICONS[mode];
        const isSelected = value === mode;

        return (
          <Button
            type="button"
            key={mode}
            role="radio"
            variant="outline"
            onClick={() => onChange(mode)}
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={cn(
              "h-auto min-h-24 flex flex-col items-center justify-between p-3.5 rounded-2xl border text-center transition-all duration-200 interactive-scale focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "border-primary bg-primary/5 text-primary shadow-sm ring-1 ring-primary/30 hover:bg-primary/10 hover:text-primary"
                : "border-border/80 text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground",
            )}
          >
            {/* Illustrated Mini Interface Window Preview */}
            <div
              className={cn(
                "w-full h-12 rounded-xl border p-1 flex gap-1 items-center justify-center transition-all duration-200 overflow-hidden shadow-2xs mb-2.5",
                mode === "light" && "bg-white border-zinc-200 text-zinc-800",
                mode === "dark" && "bg-zinc-950 border-zinc-800 text-zinc-200",

                mode === "system" &&
                  "bg-gradient-to-r from-white via-zinc-200 to-zinc-950 border-zinc-400/50 text-zinc-600 dark:text-zinc-300",
                isSelected && "ring-2 ring-primary/40 border-primary/60 shadow-sm",
              )}
              aria-hidden="true"
            >
              {mode === "light" && (
                <div className="w-full h-full flex flex-col justify-between p-1 bg-zinc-50 rounded-lg">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-0.5">
                    <div className="flex gap-0.5">
                      <span className="h-1 w-1 rounded-full bg-zinc-300" />
                      <span className="h-1 w-1 rounded-full bg-zinc-300" />
                      <span className="h-1 w-1 rounded-full bg-zinc-300" />
                    </div>
                    <Sun className="h-2.5 w-2.5 text-amber-500" />
                  </div>
                  <div className="flex gap-1 items-center">
                    <div className="h-4 w-3 bg-primary/20 rounded-xs" />
                    <div className="h-3 flex-1 bg-zinc-200/80 rounded-xs" />
                  </div>
                </div>
              )}

              {mode === "dark" && (
                <div className="w-full h-full flex flex-col justify-between p-1 bg-zinc-900 rounded-lg">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-0.5">
                    <div className="flex gap-0.5">
                      <span className="h-1 w-1 rounded-full bg-zinc-700" />
                      <span className="h-1 w-1 rounded-full bg-zinc-700" />
                      <span className="h-1 w-1 rounded-full bg-zinc-700" />
                    </div>
                    <Moon className="h-2.5 w-2.5 text-sky-400" />
                  </div>
                  <div className="flex gap-1 items-center">
                    <div className="h-4 w-3 bg-primary/30 rounded-xs" />
                    <div className="h-3 flex-1 bg-zinc-800 rounded-xs" />
                  </div>
                </div>
              )}

              {mode === "system" && (
                <div className="w-full h-full flex items-center justify-center gap-1.5 backdrop-blur-xs">
                  <Monitor className="h-4 w-4 text-foreground drop-shadow-xs" />
                </div>
              )}
            </div>

            {/* Label and Subtitle */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-center gap-1.5 font-bold text-xs">
                <Icon
                  className={cn(
                    "h-3.5 w-3.5",
                    isSelected ? "text-primary" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <span>{t(labelKey)}</span>
              </div>
              <p className="text-3xs text-muted-foreground leading-tight">{getSubLabel(mode)}</p>
            </div>
          </Button>
        );
      })}
    </div>
  );
}

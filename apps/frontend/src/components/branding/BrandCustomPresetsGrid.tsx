import React from "react";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { CustomThemePreset } from "./brandColorPanelShared";

interface BrandCustomPresetsGridProps {
  customPresets: CustomThemePreset[];
  primaryColor: string;
  secondaryColor: string;
  onApplyPreset: (primary: string, secondary: string) => void;
  onDeleteCustom: (id: string, e: React.MouseEvent) => void;
  t: TranslationFunction;
}

export function BrandCustomPresetsGrid({
  customPresets,
  primaryColor,
  secondaryColor,
  onApplyPreset,
  onDeleteCustom,
  t,
}: BrandCustomPresetsGridProps) {
  if (customPresets.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground">{t("theme.customPresetsTitle")}</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {customPresets.map((preset) => {
          const active =
            primaryColor === preset.primaryColor && secondaryColor === preset.secondaryColor;
          return (
            <div
              key={preset.id}
              onClick={() => onApplyPreset(preset.primaryColor, preset.secondaryColor)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onApplyPreset(preset.primaryColor, preset.secondaryColor);
                }
              }}
              className={cn(
                "group relative flex min-h-11 items-center justify-between gap-2 rounded-xl border p-2.5 text-start transition-all cursor-pointer hover:border-primary/40",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-muted/20 hover:bg-muted/30",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="relative h-8 w-8 shrink-0 rounded-full border border-white/20 shadow-xs"
                  style={{ backgroundColor: preset.primaryColor }}
                >
                  <span
                    className="absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 rounded-full border-2 border-background"
                    style={{ backgroundColor: preset.secondaryColor }}
                    aria-hidden
                  />
                  {active && (
                    <Check
                      className="absolute inset-0 m-auto h-4 w-4 text-background drop-shadow-sm"
                      aria-hidden
                    />
                  )}
                </span>
                <span className="min-w-0 truncate">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {preset.name}
                  </span>
                  <span className="block truncate font-mono text-2xs text-muted-foreground">
                    {preset.primaryColor}
                  </span>
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t("theme.deleteCustomPreset")}
                onClick={(e) => onDeleteCustom(preset.id, e)}
                className="min-h-11 min-w-11 p-0 text-muted-foreground opacity-70 group-hover:opacity-100 hover:text-destructive transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

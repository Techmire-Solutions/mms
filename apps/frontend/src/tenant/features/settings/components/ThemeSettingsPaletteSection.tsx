import React from "react";
import { Sparkles, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface ThemeSettingsPaletteSectionProps {
  t: TranslationFunction;
  extractedPalette: readonly string[];
  bestPair?: { primary: string; secondary: string } | null;
  onApplyBestPair?: () => void;
  onPrimaryChange: (hex: string) => void;
  onSecondaryChange: (hex: string) => void;
}

export function ThemeSettingsPaletteSection({
  t,
  extractedPalette,
  bestPair,
  onApplyBestPair,
  onPrimaryChange,
  onSecondaryChange,
}: ThemeSettingsPaletteSectionProps): React.JSX.Element | null {
  if (extractedPalette.length === 0) return null;

  return (
    <div className="mb-4 p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-3 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t("theme.logoExtractedPalette")}
        </span>
        <div className="flex items-center gap-2">
          {bestPair && onApplyBestPair && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onApplyBestPair}
              className="h-7 min-h-7 touch-target-coarse px-2 text-2xs font-bold text-primary border-primary/30 bg-primary/10 hover:bg-primary/15 rounded-md"
            >
              <Sparkles className="h-3 w-3 me-1" />
              {t("theme.applyLogoPair")}
            </Button>
          )}
          <span className="text-3xs font-medium text-muted-foreground">
            {extractedPalette.length} swatches
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {extractedPalette.map((hex, idx) => (
          <div
            key={`${hex}-${idx}`}
            className="flex items-center gap-1.5 p-1 pe-2 rounded-lg border border-border/80 bg-card shadow-2xs transition-all hover:border-primary/40"
          >
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(hex);
                notify.success(t("theme.copiedHex", { hex }));
              }}
              title={t("theme.copiedHex", { hex })}
              className="h-7 w-7 touch-target-coarse rounded-md border border-white/20 shadow-2xs shrink-0 cursor-pointer hover:scale-110 active:scale-95 transition-transform flex items-center justify-center group relative"
              style={{ backgroundColor: hex }}
              aria-label={hex}
            >
              <Copy className="h-3 w-3 text-white/0 group-hover:text-white/90 drop-shadow-sm transition-colors" />
            </button>
            <span className="font-mono text-2xs text-muted-foreground font-semibold px-0.5">
              {hex}
            </span>
            <div className="flex items-center gap-1 ps-1 border-s border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onPrimaryChange(hex)}
                className="h-6 min-h-6 touch-target-coarse px-1.5 text-3xs font-bold text-primary hover:bg-primary/10 rounded-md"
                title={t("theme.setAsPrimary")}
              >
                {t("theme.setAsPrimary")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSecondaryChange(hex)}
                className="h-6 min-h-6 touch-target-coarse px-1.5 text-3xs font-bold text-muted-foreground hover:text-foreground rounded-md"
                title={t("theme.setAsAccent")}
              >
                {t("theme.setAsAccent")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

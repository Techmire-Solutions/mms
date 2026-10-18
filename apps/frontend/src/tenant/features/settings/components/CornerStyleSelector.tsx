import React from "react";
import {
  BRANDING_CORNER_STYLE_OPTIONS,
  resolveBrandingCornerRadius,
  type BrandingCornerStyle,
  type BrandingCornerPreset,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { FORM_CARD } from "@/components/ui/formStyles";

interface CornerStyleSelectorProps {
  value: BrandingCornerStyle;
  onChange: (style: BrandingCornerStyle) => void;
}

function parseRadiusToPx(value: string): number {
  if (value === "sharp") return 2;
  if (value === "subtle") return 6;
  if (value === "rounded") return 10;
  if (value === "soft") return 16;

  const parsed = parseFloat(value);
  if (isNaN(parsed)) return 10;

  if (value.includes("rem") || value.includes("em")) {
    return Math.round(parsed * 16);
  }
  return Math.round(parsed);
}

/**
 * Tenant corner roundness — maps to CSS `--radius` (cards, inputs, buttons).
 * Fully adjustable slider with quick presets.
 */
export default function CornerStyleSelector({
  value,
  onChange,
}: CornerStyleSelectorProps): React.JSX.Element {
  const { t } = useTranslation();

  const currentPx = parseRadiusToPx(value);

  // Helper to determine if a pixel value matches a preset
  const getPresetForPx = (px: number): BrandingCornerPreset | null => {
    if (px === 2) return "sharp";
    if (px === 6) return "subtle";
    if (px === 10) return "rounded";
    if (px === 16) return "soft";
    return null;
  };

  const matchedPreset = getPresetForPx(currentPx);
  const activeOption = matchedPreset
    ? BRANDING_CORNER_STYLE_OPTIONS.find((opt) => opt.value === matchedPreset)
    : null;

  const handleSliderChange = (values: number[]): void => {
    const val = values[0] ?? 10;
    const preset = getPresetForPx(val);
    React.startTransition(() => {
      if (preset) {
        onChange(preset);
      } else {
        onChange(`${val}px`);
      }
    });
  };

  const resolvedRadius = resolveBrandingCornerRadius(value);
  const valueText =
    matchedPreset && activeOption
      ? `${resolvedRadius} (${t(activeOption.labelKey)})`
      : t("theme.cornerCustom", { radius: resolvedRadius });

  return (
    <div className={cn(FORM_CARD, "flex flex-col gap-6 p-5 shadow-sm")}>
      {/* Live Composite Preview Box */}
      <div
        className="flex flex-col items-center justify-center p-6 bg-muted/20 backdrop-blur-sm rounded-2xl border border-border/60 relative overflow-hidden transition-all duration-300 shadow-inner"
        aria-hidden="true"
      >
        <div className="w-full max-w-sm flex flex-col gap-3.5">
          {/* Mini Card Container */}
          <div
            className="bg-card border border-border/80 p-4 shadow-sm transition-all duration-300 ease-out space-y-3"
            style={{ borderRadius: resolvedRadius }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className="h-6 w-6 bg-primary/10 border border-primary/20 flex items-center justify-center text-3xs font-bold text-primary transition-all duration-300"
                  style={{ borderRadius: resolvedRadius }}
                >
                  UI
                </div>
                <span className="text-xs font-bold text-foreground">
                  {matchedPreset && activeOption
                    ? t(activeOption.labelKey)
                    : t("theme.cornerCustom", { radius: resolvedRadius })}
                </span>
              </div>
              <span
                className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 text-3xs font-mono font-bold transition-all duration-300"
                style={{ borderRadius: resolvedRadius }}
              >
                {resolvedRadius}
              </span>
            </div>

            {/* Mini Input & Button Row */}
            <div className="flex items-center gap-2 pt-1">
              <div
                className="h-8 flex-1 bg-muted/40 border border-input/80 px-2.5 flex items-center text-3xs text-muted-foreground transition-all duration-300"
                style={{ borderRadius: resolvedRadius }}
              >
                <span>{t("theme.previewSearchPlaceholder")}</span>
              </div>
              <div
                className="h-8 px-3 bg-primary text-primary-foreground font-semibold text-3xs flex items-center justify-center shadow-xs transition-all duration-300"
                style={{ borderRadius: resolvedRadius }}
              >
                <span>{t("theme.cornerPreviewButton")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slider Track Container */}
      <div className="space-y-4 px-1.5">
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-muted-foreground">{t("theme.cornerPreviewRadius")}</span>
          <span className="text-primary font-mono bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20 font-bold">
            {resolvedRadius}
          </span>
        </div>

        <Slider
          min={0}
          max={24}
          step={1}
          value={[currentPx]}
          onValueChange={handleSliderChange}
          aria-label={t("theme.cornerStyleTitle")}
          aria-valuetext={valueText}
          className="py-2"
        />

        {/* Step Snap Preset Buttons */}
        <div className="flex justify-between gap-1.5 px-0.5">
          {BRANDING_CORNER_STYLE_OPTIONS.map((opt) => {
            const isSelected = matchedPreset === opt.value;

            return (
              <Button
                key={opt.value}
                type="button"
                variant="ghost"
                onClick={() => onChange(opt.value)}
                aria-pressed={isSelected}
                className={cn(
                  "min-h-11 flex-1 text-xs font-bold tracking-wide px-2 rounded-lg transition-all duration-200",
                  isSelected
                    ? "text-primary bg-primary/10 border border-primary/20 shadow-sm font-extrabold"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                {t(opt.labelKey)}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Current Description */}
      <p className="text-xs text-muted-foreground leading-relaxed m-0 text-center px-1">
        {matchedPreset && activeOption
          ? t(activeOption.descriptionKey)
          : t("theme.cornerStyleHint")}
      </p>
    </div>
  );
}

import React, { useRef } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { LogoColorProportion } from "@mms/shared";
import { notify } from "@/lib/notify";
import { ThemeSettingsPaletteSection } from "./ThemeSettingsPaletteSection";

export interface ThemeSettingsLogoColourSourceProps {
  t: TranslationFunction;
  logoUrl: string;
  isSample?: boolean;
  extractedPalette?: readonly string[];
  proportions?: readonly LogoColorProportion[];
  bestPair?: { primary: string; secondary: string } | null;
  onApplyBestPair?: () => void;
  onSetSampleLogo?: (dataUrl: string) => void;
  onClearSampleLogo?: () => void;
  onPrimaryChange: (hex: string) => void;
  onSecondaryChange: (hex: string) => void;
}

export function ThemeSettingsLogoColourSource({
  t,
  logoUrl,
  isSample = false,
  extractedPalette = [],
  proportions = [],
  bestPair = null,
  onApplyBestPair,
  onSetSampleLogo,
  onClearSampleLogo,
  onPrimaryChange,
  onSecondaryChange,
}: ThemeSettingsLogoColourSourceProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSampleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onSetSampleLogo?.(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <>
      {logoUrl.trim() ? (
        <div className="mb-4 space-y-3 rounded-xl border border-border/80 bg-muted/30 backdrop-blur-sm p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={logoUrl}
                alt={t("theme.logoSourceAlt")}
                className="h-12 w-12 shrink-0 rounded-lg border border-border object-contain bg-background p-1 shadow-sm"
              />
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-foreground">
                    {isSample ? t("theme.sampleImageBadge") : t("branding.logo")}
                  </p>
                  {isSample && (
                    <Badge
                      variant="outline"
                      className="text-3xs px-1.5 py-0 border-primary/30 text-primary bg-primary/5"
                    >
                      {t("theme.sampleImageBadge")}
                    </Badge>
                  )}
                </div>
                <p className="text-2xs text-muted-foreground leading-relaxed truncate">
                  {isSample ? t("theme.testLogoDropzone") : t("theme.logoSourceHint")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isSample ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClearSampleLogo}
                  className="h-8 min-h-8 px-2 text-2xs text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5 me-1" />
                  {t("theme.clearSampleLogo")}
                </Button>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    aria-label={t("theme.testLogoButton")}
                    className="hidden"
                    onChange={handleSampleFile}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 min-h-8 px-2 text-2xs font-semibold text-muted-foreground hover:text-foreground"
                    title={t("theme.testLogoButton")}
                  >
                    <Upload className="h-3 w-3 me-1" />
                    {t("theme.testLogoButton")}
                  </Button>
                </>
              )}
            </div>
          </div>

          {proportions.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-border/50">
              <div className="flex items-center justify-between text-3xs font-semibold text-muted-foreground">
                <span>{t("theme.autoExtractedTitle")}</span>
                <span className="font-mono">
                  {proportions
                    .slice(0, 4)
                    .map((p) => `${p.hex.toUpperCase()} (${p.percentage}%)`)
                    .join(" · ")}
                </span>
              </div>
              <div className="h-3 w-full flex rounded-md overflow-hidden border border-border/60 bg-muted/40 shadow-inner">
                {proportions.map((item, i) => (
                  <div
                    key={`prop-${item.hex}-${i}`}
                    style={{ width: `${item.percentage}%`, backgroundColor: item.hex }}
                    title={`${item.hex} (${item.percentage}%) — click to copy`}
                    className="h-full transition-all duration-300 hover:opacity-90 cursor-pointer"
                    onClick={() => {
                      void navigator.clipboard?.writeText(item.hex);
                      notify.success(t("theme.copiedHex", { hex: item.hex }));
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-dashed border-border bg-muted/20">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">{t("theme.logoSourceMissing")}</p>
            <p className="text-2xs text-muted-foreground">{t("theme.testLogoDropzone")}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-label={t("theme.testLogoButton")}
              className="hidden"
              onChange={handleSampleFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-11 px-3 text-xs font-semibold"
            >
              <Upload className="h-3.5 w-3.5 me-1.5" />
              {t("theme.testLogoButton")}
            </Button>
          </div>
        </div>
      )}

      <ThemeSettingsPaletteSection
        t={t}
        extractedPalette={extractedPalette}
        bestPair={bestPair}
        onApplyBestPair={onApplyBestPair}
        onPrimaryChange={onPrimaryChange}
        onSecondaryChange={onSecondaryChange}
      />
    </>
  );
}

import React from "react";
import { Palette, ImageIcon, Loader2 } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import BrandColorPanel from "@/components/branding/BrandColorPanel";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { BrandingThemeMode, LogoColorProportion } from "@mms/shared";
import { ThemeSettingsLogoColourSource } from "./ThemeSettingsLogoColourSource";

export interface ThemeSettingsColoursSectionProps {
  t: TranslationFunction;
  logoUrl: string;
  isSample?: boolean;
  primaryColor: string;
  secondaryColor: string;
  previewMode: BrandingThemeMode;
  extractedPalette?: readonly string[];
  proportions?: readonly LogoColorProportion[];
  bestPair?: { primary: string; secondary: string } | null;
  applyingLogoColors: boolean;
  onApplyLogoColors: () => void;
  onApplyBestPair?: () => void;
  onSetSampleLogo?: (dataUrl: string) => void;
  onClearSampleLogo?: () => void;
  onGoToInstitution: () => void;
  onPrimaryChange: (hex: string) => void;
  onSecondaryChange: (hex: string) => void;
  onApplyPreset: (primary: string, secondary: string) => void;
}

export function ThemeSettingsColoursSection({
  t,
  logoUrl,
  isSample = false,
  primaryColor,
  secondaryColor,
  previewMode,
  extractedPalette = [],
  proportions = [],
  bestPair = null,
  applyingLogoColors,
  onApplyLogoColors,
  onApplyBestPair,
  onSetSampleLogo,
  onClearSampleLogo,
  onGoToInstitution,
  onPrimaryChange,
  onSecondaryChange,
  onApplyPreset,
}: ThemeSettingsColoursSectionProps): React.JSX.Element {
  return (
    <SectionCard
      title={t("theme.coloursTitle")}
      subtitle={t("theme.coloursSubtitle")}
      icon={Palette}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={applyingLogoColors || !logoUrl.trim()}
            onClick={onApplyLogoColors}
            className="min-h-11 px-3 text-xs"
          >
            {applyingLogoColors ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" aria-hidden />
            ) : (
              <ImageIcon className="h-3.5 w-3.5 me-1.5" aria-hidden />
            )}
            {applyingLogoColors ? t("theme.applyingLogoColors") : t("theme.applyLogoColors")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onGoToInstitution}
            className="min-h-11 px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("theme.goToInstitution")}
          </Button>
        </div>
      }
    >
      <ThemeSettingsLogoColourSource
        t={t}
        logoUrl={logoUrl}
        isSample={isSample}
        extractedPalette={extractedPalette}
        proportions={proportions}
        bestPair={bestPair}
        onApplyBestPair={onApplyBestPair}
        onSetSampleLogo={onSetSampleLogo}
        onClearSampleLogo={onClearSampleLogo}
        onPrimaryChange={onPrimaryChange}
        onSecondaryChange={onSecondaryChange}
      />

      <BrandColorPanel
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        previewMode={previewMode}
        onPrimaryChange={onPrimaryChange}
        onSecondaryChange={onSecondaryChange}
        onApplyPreset={onApplyPreset}
      />
    </SectionCard>
  );
}

import React, { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import {
  brandingTokenToHex,
  buildBrandingCssVariables,
  suggestHarmoniousSecondaryColor,
  type BrandingHarmonyScheme,
  type BrandingThemeMode,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import {
  BrandDerivedTokens,
  BrandPresetPicker,
  BrandSemanticPreview,
} from "@/components/branding/BrandColorPanelSections";
import { BrandColorContrastMatrix } from "@/components/branding/BrandColorContrastMatrix";
import { BrandColorField } from "@/components/branding/BrandColorField";
import { BrandColorImportModal } from "@/components/branding/BrandColorImportModal";
import { BrandColorHarmonyBar } from "@/components/branding/BrandColorHarmonyBar";
import { notify } from "@/lib/notify";

interface BrandColorPanelProps {
  primaryColor: string;
  secondaryColor: string;
  previewMode: BrandingThemeMode;
  onPrimaryChange: (hex: string) => void;
  onSecondaryChange: (hex: string) => void;
  onApplyPreset: (primary: string, secondary: string) => void;
}

/**
 * Brand colour editor — paired palettes, dual-mode contrast matrix, multi-scheme harmony, and semantic preview.
 */
export default function BrandColorPanel({
  primaryColor,
  secondaryColor,
  previewMode,
  onPrimaryChange,
  onSecondaryChange,
  onApplyPreset,
}: BrandColorPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const [harmonyScheme, setHarmonyScheme] = useState<BrandingHarmonyScheme>("split-complementary");
  const [isImporting, setIsImporting] = useState(false);

  const tokens = (() => buildBrandingCssVariables(primaryColor, secondaryColor, previewMode))();

  const onPrimaryBg = brandingTokenToHex(tokens["--primary"] ?? "", primaryColor);
  const onPrimaryFg = brandingTokenToHex(tokens["--primary-foreground"] ?? "", "#ffffff");
  const onSecondaryBg = brandingTokenToHex(tokens["--secondary"] ?? "", secondaryColor);
  const onSecondaryFg = brandingTokenToHex(tokens["--secondary-foreground"] ?? "", "#ffffff");

  const handleSwapColors = (): void => {
    onPrimaryChange(secondaryColor);
    onSecondaryChange(primaryColor);
  };

  const handleCopyPalette = (): void => {
    const payload = JSON.stringify({ primary: primaryColor, accent: secondaryColor }, null, 2);
    void navigator.clipboard.writeText(payload);
    notify.success(t("theme.paletteCopied"));
  };

  const handleImport = (primary: string, secondary: string): void => {
    onPrimaryChange(primary);
    onSecondaryChange(secondary);
    setIsImporting(false);
  };

  return (
    <div className="space-y-5">
      <BrandColorImportModal
        open={isImporting}
        onClose={() => setIsImporting(false)}
        onImport={handleImport}
      />

      <BrandPresetPicker
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        previewMode={previewMode}
        onApplyPreset={onApplyPreset}
      />

      <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BrandColorField
          id="primaryColor"
          label={t("theme.primaryColourLabel")}
          description={t("theme.primaryColourDesc")}
          value={primaryColor}
          onChange={onPrimaryChange}
        />
        <BrandColorField
          id="secondaryColor"
          label={t("theme.accentColourLabel")}
          description={t("theme.accentColourDesc")}
          value={secondaryColor}
          onChange={onSecondaryChange}
        />

        <div className="hidden lg:flex absolute start-1/2 top-10 -translate-x-1/2 rtl:translate-x-1/2 z-elevated">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSwapColors}
            title={t("theme.swapColors")}
            aria-label={t("theme.swapColors")}
            className="h-8 w-8 p-0 rounded-full border-border bg-card shadow-sm hover:bg-muted hover:scale-110 active:scale-95 transition-all"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 pt-1">
        <BrandColorHarmonyBar
          harmonyScheme={harmonyScheme}
          onHarmonySchemeChange={(scheme) => {
            setHarmonyScheme(scheme);
            onSecondaryChange(suggestHarmoniousSecondaryColor(primaryColor, scheme));
          }}
          onSwapColors={handleSwapColors}
          onHarmonizeAccent={() =>
            onSecondaryChange(suggestHarmoniousSecondaryColor(primaryColor, harmonyScheme))
          }
          onCopyPalette={handleCopyPalette}
          onOpenImport={() => setIsImporting(true)}
          t={t}
        />

        <BrandColorContrastMatrix
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          onPrimaryChange={onPrimaryChange}
          onSecondaryChange={onSecondaryChange}
        />
      </div>

      <BrandSemanticPreview
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        previewMode={previewMode}
        tokens={tokens}
        onPrimaryBg={onPrimaryBg}
        onPrimaryFg={onPrimaryFg}
        onSecondaryBg={onSecondaryBg}
        onSecondaryFg={onSecondaryFg}
      />

      <BrandDerivedTokens tokens={tokens} />
    </div>
  );
}

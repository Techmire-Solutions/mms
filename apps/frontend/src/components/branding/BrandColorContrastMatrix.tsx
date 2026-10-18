import React from "react";
import { Sparkles } from "lucide-react";
import {
  brandingTokenToHex,
  buildBrandingCssVariables,
  ensureAccessibleBrandColor,
  getContrastRatio,
  meetsWcagAaTextContrast,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BrandColorContrastMatrixProps {
  primaryColor: string;
  secondaryColor: string;
  onPrimaryChange: (hex: string) => void;
  onSecondaryChange: (hex: string) => void;
}

export function BrandColorContrastMatrix({
  primaryColor,
  secondaryColor,
  onPrimaryChange,
  onSecondaryChange,
}: BrandColorContrastMatrixProps): React.JSX.Element | null {
  const { t } = useTranslation();

  const lightTokens = (() => buildBrandingCssVariables(primaryColor, secondaryColor, "light"))();
  const darkTokens = (() => buildBrandingCssVariables(primaryColor, secondaryColor, "dark"))();

  const lightPrimaryBg = brandingTokenToHex(lightTokens["--primary"] ?? "", primaryColor);
  const lightPrimaryFg = brandingTokenToHex(lightTokens["--primary-foreground"] ?? "", "#ffffff");
  const lightPrimaryContrast = getContrastRatio(lightPrimaryFg, lightPrimaryBg);
  const lightPrimaryPasses = meetsWcagAaTextContrast(lightPrimaryContrast);

  const lightSecondaryBg = brandingTokenToHex(lightTokens["--secondary"] ?? "", secondaryColor);
  const lightSecondaryFg = brandingTokenToHex(
    lightTokens["--secondary-foreground"] ?? "",
    "#ffffff",
  );
  const lightSecondaryContrast = getContrastRatio(lightSecondaryFg, lightSecondaryBg);
  const lightSecondaryPasses = meetsWcagAaTextContrast(lightSecondaryContrast);

  const darkPrimaryBg = brandingTokenToHex(darkTokens["--primary"] ?? "", primaryColor);
  const darkPrimaryFg = brandingTokenToHex(darkTokens["--primary-foreground"] ?? "", "#ffffff");
  const darkPrimaryContrast = getContrastRatio(darkPrimaryFg, darkPrimaryBg);
  const darkPrimaryPasses = meetsWcagAaTextContrast(darkPrimaryContrast);

  const darkSecondaryBg = brandingTokenToHex(darkTokens["--secondary"] ?? "", secondaryColor);
  const darkSecondaryFg = brandingTokenToHex(darkTokens["--secondary-foreground"] ?? "", "#ffffff");
  const darkSecondaryContrast = getContrastRatio(darkSecondaryFg, darkSecondaryBg);
  const darkSecondaryPasses = meetsWcagAaTextContrast(darkSecondaryContrast);

  const primaryBothPass = lightPrimaryPasses && darkPrimaryPasses;
  const secondaryBothPass = lightSecondaryPasses && darkSecondaryPasses;

  if (lightPrimaryContrast === null && lightSecondaryContrast === null) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl border border-border/80 bg-muted/20">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground me-0.5 shrink-0">
          {t("theme.wcagContrast")}:
        </span>

        {lightPrimaryContrast !== null && darkPrimaryContrast !== null && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-mono whitespace-nowrap shadow-2xs transition-all",
                primaryBothPass
                  ? "border-border/80 bg-card text-foreground"
                  : "border-warning/50 bg-warning/5 text-warning",
              )}
              title={primaryBothPass ? t("theme.contrastBothPass") : t("theme.contrastBothFail")}
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0 border border-white/20 shadow-2xs"
                style={{ backgroundColor: primaryColor }}
                aria-hidden="true"
              />
              <span className="font-bold">P:</span>
              <span>
                {t("theme.contrastDualSummary", {
                  lightRatio: lightPrimaryContrast.toFixed(1),
                  darkRatio: darkPrimaryContrast.toFixed(1),
                })}
              </span>
            </div>
            {!primaryBothPass && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onPrimaryChange(ensureAccessibleBrandColor(primaryColor, 4.5))}
                className="h-8 min-h-8 px-2 text-2xs font-semibold text-primary whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3 w-3 me-1 shrink-0" />
                {t("theme.autoFixContrast")}
              </Button>
            )}
          </div>
        )}

        {lightSecondaryContrast !== null && darkSecondaryContrast !== null && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-mono whitespace-nowrap shadow-2xs transition-all",
                secondaryBothPass
                  ? "border-border/80 bg-card text-foreground"
                  : "border-warning/50 bg-warning/5 text-warning",
              )}
              title={secondaryBothPass ? t("theme.contrastBothPass") : t("theme.contrastBothFail")}
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0 border border-white/20 shadow-2xs"
                style={{ backgroundColor: secondaryColor }}
                aria-hidden="true"
              />
              <span className="font-bold">A:</span>
              <span>
                {t("theme.contrastDualSummary", {
                  lightRatio: lightSecondaryContrast.toFixed(1),
                  darkRatio: darkSecondaryContrast.toFixed(1),
                })}
              </span>
            </div>
            {!secondaryBothPass && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSecondaryChange(ensureAccessibleBrandColor(secondaryColor, 4.5))}
                className="h-8 min-h-8 px-2 text-2xs font-semibold text-primary whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3 w-3 me-1 shrink-0" />
                {t("theme.autoFixContrast")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

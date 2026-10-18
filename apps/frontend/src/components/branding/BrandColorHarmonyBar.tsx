import React from "react";
import { ArrowLeftRight, Copy, Upload, Wand2 } from "lucide-react";
import {
  BRANDING_HARMONY_SCHEMES,
  type AppTranslationKey,
  type BrandingHarmonyScheme,
} from "@mms/shared";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

interface BrandColorHarmonyBarProps {
  harmonyScheme: BrandingHarmonyScheme;
  onHarmonySchemeChange: (scheme: BrandingHarmonyScheme) => void;
  onSwapColors: () => void;
  onHarmonizeAccent: () => void;
  onCopyPalette: () => void;
  onOpenImport: () => void;
  t: TranslationFunction;
}

export function BrandColorHarmonyBar({
  harmonyScheme,
  onHarmonySchemeChange,
  onSwapColors,
  onHarmonizeAccent,
  onCopyPalette,
  onOpenImport,
  t,
}: BrandColorHarmonyBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSwapColors}
          title={t("theme.swapColors")}
          className="min-h-11 px-3 text-xs whitespace-nowrap shrink-0 lg:hidden"
        >
          <ArrowLeftRight className="h-3.5 w-3.5 me-1.5 shrink-0" />
          <span>{t("theme.swapColors")}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onHarmonizeAccent}
          className="min-h-11 px-3 text-xs whitespace-nowrap shrink-0"
        >
          <Wand2 className="h-3.5 w-3.5 me-1.5 shrink-0" />
          <span>{t("theme.harmonizeAccent")}</span>
        </Button>
        <Select
          value={harmonyScheme}
          onValueChange={(val) => onHarmonySchemeChange(val as BrandingHarmonyScheme)}
        >
          <SelectTrigger
            aria-label={t("theme.harmonyScheme")}
            className="h-11 min-h-11 w-44 shrink-0 text-xs font-medium"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRANDING_HARMONY_SCHEMES.map((scheme) => (
              <SelectItem key={scheme.id} value={scheme.id} className="text-xs">
                {t(scheme.labelKey as AppTranslationKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopyPalette}
          className="min-h-11 px-3 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap shrink-0"
        >
          <Copy className="h-3.5 w-3.5 me-1.5 shrink-0" />
          <span>{t("theme.copyPalette")}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenImport}
          className="min-h-11 px-3 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap shrink-0"
        >
          <Upload className="h-3.5 w-3.5 me-1.5 shrink-0" />
          <span>{t("theme.pastePalette")}</span>
        </Button>
      </div>
    </div>
  );
}

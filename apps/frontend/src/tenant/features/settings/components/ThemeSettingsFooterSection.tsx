import React from "react";
import { Wand2 } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FieldHint, FOOTER_MAX } from "@/components/branding/BrandingShared";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface ThemeSettingsFooterSectionProps {
  t: TranslationFunction;
  footerText: string;
  footerPreview: string;
  defaultFooterPreview: string;
  logoUrl: string;
  madrasaName: string;
  onFooterChange: (value: string) => void;
  onGenerateFooter: () => void;
}

export function ThemeSettingsFooterSection({
  t,
  footerText,
  footerPreview,
  defaultFooterPreview,
  logoUrl,
  madrasaName,
  onFooterChange,
  onGenerateFooter,
}: ThemeSettingsFooterSectionProps): React.JSX.Element {
  return (
    <SectionCard
      title={t("theme.footerTitle")}
      subtitle={t("theme.footerSubtitle")}
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onGenerateFooter}
          className="min-h-11 px-3 text-xs"
        >
          <Wand2 className="h-3.5 w-3.5 me-1.5" />
          {t("theme.footerGenerate")}
        </Button>
      }
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="footerText">{t("theme.footerLabel")}</Label>
          <span className="text-xs font-mono text-muted-foreground" aria-live="polite">
            {footerText.length}/{FOOTER_MAX}
          </span>
        </div>
        <Textarea
          id="footerText"
          value={footerText}
          maxLength={FOOTER_MAX}
          rows={2}
          placeholder={defaultFooterPreview}
          aria-describedby="footerText-hint"
          onChange={(event) => onFooterChange(event.target.value)}
        />
        <FieldHint id="footerText-hint">{t("theme.footerHint")}</FieldHint>

        {/* Quick Template Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-2xs font-semibold text-muted-foreground me-1">
            {t("theme.templatesLabel")}:
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const year = new Date().getFullYear();
              const name = madrasaName.trim() || t("theme.authPreviewNamePlaceholder");
              onFooterChange(t("theme.templateStandardText", { year: String(year), name }));
            }}
            className="min-h-7 h-7 text-2xs px-2.5 rounded-full border-border/80 text-muted-foreground hover:text-foreground"
          >
            {t("theme.templateStandard")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const year = new Date().getFullYear();
              const name = madrasaName.trim() || t("theme.authPreviewNamePlaceholder");
              onFooterChange(t("theme.templateEducationalText", { year: String(year), name }));
            }}
            className="min-h-7 h-7 text-2xs px-2.5 rounded-full border-border/80 text-muted-foreground hover:text-foreground"
          >
            {t("theme.templateEducational")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const year = new Date().getFullYear();
              const name = madrasaName.trim() || t("theme.authPreviewNamePlaceholder");
              onFooterChange(t("theme.templateCommunityText", { year: String(year), name }));
            }}
            className="min-h-7 h-7 text-2xs px-2.5 rounded-full border-border/80 text-muted-foreground hover:text-foreground"
          >
            {t("theme.templateCommunity")}
          </Button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground">{t("theme.authPreviewLabel")}</p>
        <div
          className={`${WORK_SURFACE} overflow-hidden rounded-2xl border border-border/80 shadow-md`}
        >
          <div className="flex flex-col items-center gap-3 border-b border-border bg-muted/30 px-6 py-8">
            {logoUrl.trim() ? (
              <img
                src={logoUrl}
                alt={t("theme.authPreviewLogoAlt")}
                className="h-14 w-14 rounded-xl border border-border object-contain bg-background p-1 shadow-sm"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                {t("theme.authPreviewLogoPlaceholder")}
              </div>
            )}
            <p className="text-sm font-bold tracking-tight text-foreground">
              {madrasaName.trim() || t("theme.authPreviewNamePlaceholder")}
            </p>
          </div>
          <p className="px-4 py-3.5 text-center text-xs text-muted-foreground leading-relaxed font-medium">
            {footerPreview}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

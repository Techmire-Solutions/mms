import { brandingTokenToCss } from "@mms/shared";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

import type { BrandSemanticPreviewContext } from "./brandColorPanelShared";

export function BrandSemanticPreviewActionsTab({
  activeOnPrimaryBg,
  activeOnPrimaryFg,
  activeOnSecondaryBg,
  activeOnSecondaryFg,
  activeTokens,
  chartPalette,
}: BrandSemanticPreviewContext) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      <div className="space-y-3.5 border-b border-border bg-card/40 p-4 md:border-b-0 md:border-e">
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-h-11 w-full rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-transform interactive-scale hover:shadow-xl"
          style={{ backgroundColor: activeOnPrimaryBg, color: activeOnPrimaryFg }}
        >
          {t("theme.previewPrimaryAction")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-h-11 w-full rounded-lg border px-4 py-2.5 text-sm font-semibold transition-transform interactive-scale hover:shadow-xl"
          style={{
            backgroundColor: activeOnSecondaryBg,
            color: activeOnSecondaryFg,
            borderColor: activeOnSecondaryBg,
          }}
        >
          {t("theme.previewAccentAction")}
        </Button>
        <div className="flex flex-wrap gap-2 pt-1">
          <span
            className="inline-flex items-center gap-1.5 font-bold rounded-md border px-2.5 py-1 text-xs shadow-2xs transition-all"
            style={{
              backgroundColor: `${activeOnPrimaryBg}18`,
              color: activeOnPrimaryBg,
              borderColor: `${activeOnPrimaryBg}35`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 shadow-2xs"
              style={{ backgroundColor: activeOnPrimaryBg }}
              aria-hidden="true"
            />
            {t("theme.previewStatusBadge")}
          </span>
          <span
            className="inline-flex items-center gap-1.5 font-bold rounded-md border px-2.5 py-1 text-xs shadow-2xs transition-all"
            style={{
              backgroundColor: `${activeOnSecondaryBg}18`,
              color: activeOnSecondaryBg,
              borderColor: `${activeOnSecondaryBg}35`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 shadow-2xs"
              style={{ backgroundColor: activeOnSecondaryBg }}
              aria-hidden="true"
            />
            {t("theme.previewAccentBadge")}
          </span>
        </div>
      </div>
      <div className="space-y-3.5 bg-muted/10 p-4">
        <div
          className="rounded-xl border p-3.5 shadow-2xs"
          style={{
            backgroundColor: brandingTokenToCss(activeTokens["--muted"]!),
            borderColor: brandingTokenToCss(activeTokens["--border"]!),
          }}
        >
          <p
            className="text-xs font-semibold"
            style={{ color: brandingTokenToCss(activeTokens["--foreground"]!) }}
          >
            {t("theme.previewCardTitle")}
          </p>
          <p
            className="mt-1 text-xs leading-relaxed"
            style={{ color: brandingTokenToCss(activeTokens["--muted-foreground"]!) }}
          >
            {t("theme.previewCardBody")}
          </p>
        </div>
        <div
          className="flex items-center justify-between rounded-xl px-3.5 py-2.5 shadow-2xs"
          style={{ backgroundColor: brandingTokenToCss(activeTokens["--sidebar-background"]!) }}
        >
          <span
            className="text-xs font-semibold"
            style={{ color: brandingTokenToCss(activeTokens["--sidebar-foreground"]!) }}
          >
            {t("theme.previewSidebar")}
          </span>
          <span
            className="h-2.5 w-2.5 rounded-full ring-2 ring-background"
            style={{ backgroundColor: brandingTokenToCss(activeTokens["--sidebar-primary"]!) }}
            aria-hidden
          />
        </div>
        <div className="space-y-1.5 pt-1">
          <p className="text-xs font-medium text-muted-foreground">
            {t("theme.chartPreviewTitle")}
          </p>
          <div className="flex gap-1.5">
            {chartPalette.charts.map((hex, index) => (
              <span
                key={`chart-${index}`}
                className="h-6 flex-1 rounded-md border border-border/80 shadow-2xs transition-transform hover:scale-105"
                style={{ backgroundColor: hex }}
                aria-label={t("theme.chartPreviewSwatch", { index: index + 1 })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { Button } from "@mms/ui";
import { FORM_LABEL } from "@mms/ui";
import { LegendChip } from "@mms/ui/app/LegendChip";
import { useTranslation } from "@mms/fe-core/i18n";
import { useBrandPalette } from "../../host/useBrandPalette";
import { resolveWidgetChartHex } from "@mms/fe-core/ui/brandingChartPalette";

interface WidgetBuilderColorOptionsProps {
  builderColor: string;
  setBuilderColor: (builderColor: string) => void;
}

export function WidgetBuilderColorOptions({
  builderColor,
  setBuilderColor,
}: WidgetBuilderColorOptionsProps): React.JSX.Element {
  const { t } = useTranslation();
  const palette = useBrandPalette();

  return (
    <div className="space-y-1.5 text-start font-sans">
      <p className={`${FORM_LABEL} block`}>{t("reports.widgets.builder.defaultColor")}</p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "emerald", labelKey: "reports.widgets.builder.themeEmerald" },
            { id: "blue", labelKey: "reports.widgets.builder.themeBlue" },
            { id: "violet", labelKey: "reports.widgets.builder.themeViolet" },
            { id: "amber", labelKey: "reports.widgets.builder.themeAmber" },
            { id: "red", labelKey: "reports.widgets.builder.themeRed" },
          ] as const
        ).map((colorOption: any) => {
          const isSelected = builderColor === colorOption.id;
          const cMap = resolveWidgetChartHex(colorOption.id, palette);
          return (
            <Button
              key={colorOption.id}
              type="button"
              variant="outline"
              onClick={() => setBuilderColor(colorOption.id)}
              className={`min-h-11 flex items-center gap-1.5 px-3 rounded-xl border text-xs font-bold shadow-none ${
                isSelected
                  ? "border-primary ring-2 ring-primary/20 scale-105"
                  : "border-border hover:border-muted-foreground/30 text-muted-foreground bg-card/25"
              }`}
            >
              <LegendChip
                dotStyle={{ background: cMap }}
                dotClassName="border border-black/5"
                label={t(colorOption.labelKey)}
              />
            </Button>
          );
        })}
      </div>
    </div>
  );
}

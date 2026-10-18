import React from "react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/app/SectionLabel";
import { Slider } from "@/components/ui/slider";
import { useTranslation } from "@/hooks/useTranslation";
import type { ReportCollectionsSnapshot } from "@/lib/reports/useReportCollections";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { WORK_SURFACE, WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

interface WidgetBuilderPreviewProps {
  previewWidget: CustomWidget;
  collections: ReportCollectionsSnapshot;
  scalerSize: number;
  setScalerSize: (scalerSize: number) => void;
  onCancelEdit: () => void;
  onSave: () => void;
  canSave: boolean;
  isEditing: boolean;
  onSwitchToggle: () => void;
  renderWidget: (widget: CustomWidget, isCompact: boolean) => React.ReactNode;
}

export function WidgetBuilderPreview({
  previewWidget,
  collections: _collections,
  scalerSize,
  setScalerSize,
  onCancelEdit,
  onSave,
  canSave,
  isEditing,
  onSwitchToggle: _onSwitchToggle,
  renderWidget,
}: WidgetBuilderPreviewProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className={cn(WORK_SURFACE, "p-4 flex flex-col justify-between relative min-h-preview")}>
      <div className="space-y-4">
        <div className="flex items-center justify-between text-start">
          <SectionLabel className="block">
            {t("reports.widgets.builder.testerPreview")}
          </SectionLabel>
          <span className="text-xs text-primary font-bold">
            {scalerSize}x{scalerSize}px
          </span>
        </div>

        <div className="space-y-2 bg-card/30 p-2.5 rounded-xl border border-border/50">
          <SectionLabel as="p" tracking="wider" className="block">
            {t("reports.widgets.builder.dragToScale")}
          </SectionLabel>
          <Slider
            min={100}
            max={250}
            step={1}
            value={[scalerSize]}
            onValueChange={(val) => setScalerSize(val[0] ?? 100)}
            className="py-1"
            aria-label={t("reports.widgets.builder.dragToScale")}
          />
        </div>

        <div className="flex items-center justify-center py-4 bg-muted/10 rounded-2xl border border-dashed border-border/60 min-h-panel-sm">
          <div
            className={cn(
              WORK_SURFACE_INNER,
              "overflow-hidden shadow-lg rounded-3xl transition-all duration-100 flex items-center justify-center animate-fade-in",
            )}
            style={{ width: scalerSize, height: scalerSize }}
          >
            {renderWidget(previewWidget, scalerSize < 140)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancelEdit}
          className="flex-1 h-auto py-2.5 rounded-xl border border-border bg-card/50 hover:bg-muted text-foreground font-black text-xs uppercase tracking-wider shadow-none"
        >
          {t("reports.widgets.builder.cancel")}
        </Button>
        <Button
          type="button"
          disabled={!canSave}
          onClick={onSave}
          className="flex-2 h-auto py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-wider disabled:opacity-40 shadow-lg hover:shadow-primary/20 shadow-primary/10"
        >
          {isEditing
            ? t("reports.widgets.builder.updateWidget")
            : t("reports.widgets.builder.createWidget")}
        </Button>
      </div>
    </div>
  );
}

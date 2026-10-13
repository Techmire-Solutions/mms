import React from "react";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { WidgetBuilderPreview } from "@/components/ui/reports/pinnedWidgets/WidgetBuilderPreview";
import { WidgetBuilderHeader } from "@/components/ui/reports/pinnedWidgets/WidgetBuilderHeader";
import { WidgetBuilderOptionsPanel } from "@/components/ui/reports/pinnedWidgets/WidgetBuilderOptionsPanel";
import { useWidgetBuilderState } from "@/components/ui/reports/pinnedWidgets/useWidgetBuilderState";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

interface WidgetBuilderProps {
  initialCollection: CustomWidget["collection"];
  editWidgetConfig: CustomWidget | null;
  onCancelEdit: () => void;
  onSaveWidget: (widget: CustomWidget) => void;
  category?: string;
  mode?: "dashboard" | "kpi";
  initialWidgetType?: CustomWidget["widgetType"];
  renderWidget: (widget: CustomWidget, isCompact: boolean) => React.ReactNode;
}

export function WidgetBuilder({
  initialCollection,
  editWidgetConfig,
  onCancelEdit,
  onSaveWidget,
  category = "students",
  mode = "kpi",
  initialWidgetType = "kpi",
  renderWidget,
}: WidgetBuilderProps): React.JSX.Element {
  const {
    collections,
    widgetType,
    setWidgetType,
    scalerSize,
    setScalerSize,
    previewWidget,
    handleSaveWidget,
    canSave,
    dbRecordsList,
    titleState,
    metricState,
    thresholdState,
    switchState,
    cardState,
    iconState,
  } = useWidgetBuilderState({
    initialCollection,
    editWidgetConfig,
    category,
    mode,
    initialWidgetType,
    onSaveWidget,
  });

  return (
    <div className={cn(WORK_SURFACE, "overflow-hidden p-6 space-y-4 font-sans text-start")}>
      <WidgetBuilderHeader />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        <WidgetBuilderOptionsPanel
          mode={mode}
          widgetType={widgetType}
          setWidgetType={setWidgetType}
          titleState={titleState}
          metricState={metricState}
          thresholdState={thresholdState}
          switchState={switchState}
          cardState={cardState}
          iconState={iconState}
          dbRecordsList={dbRecordsList}
        />

        <WidgetBuilderPreview
          previewWidget={previewWidget}
          collections={collections}
          scalerSize={scalerSize}
          setScalerSize={setScalerSize}
          onCancelEdit={onCancelEdit}
          onSave={handleSaveWidget}
          canSave={canSave}
          isEditing={Boolean(editWidgetConfig)}
          onSwitchToggle={() => {}}
          renderWidget={renderWidget}
        />
      </div>
    </div>
  );
}

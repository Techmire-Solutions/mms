import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import type { StatItem } from "@/lib/dashboardWidgets";
import type { Permission } from "@mms/shared";

export interface DashboardCustomizePanelProps {
  can: (permission: Permission) => boolean;
  customWidgets: CustomWidget[];
  disabledCardIds: string[];
  toggleCardVisibility: (cardId: string) => void;
  dashboardMetricCards: StatItem[];
  selectedDashboardCardCount: number;
  pinnedDashboardWidgetCount: number;
  isWidgetBuilderOpen: boolean;
  editingWidget: CustomWidget | null;
  widgetBuilderType: CustomWidget["widgetType"];
  lowAttendanceThreshold?: number;
  urgentAttendanceThreshold?: number;
  gridMode?: "comfortable" | "compact";
  onUpdateThreshold?: (
    key: "lowAttendanceThreshold" | "urgentAttendanceThreshold",
    value: number,
  ) => void;
  onUpdateGridMode?: (mode: "comfortable" | "compact") => void;
  onCloseBuilder: () => void;
  onSaveWidget: (widget: CustomWidget) => void;
  onEditWidget: (widget: CustomWidget) => void;
  onDeleteWidget: (widgetId: string) => void;
  onToggleWidgetPin: (widgetId: string) => void;
  onOpenWidgetBuilder: (type: CustomWidget["widgetType"], widget?: CustomWidget | null) => void;
  onReorderWidgets?: (widgets: CustomWidget[]) => void;
}

import type { WidgetBuilderIconTab } from "@/components/ui/reports/pinnedWidgets/WidgetBuilderCardOptions";
import type { SwitchRecordOption } from "@/components/ui/reports/pinnedWidgets/WidgetBuilderSwitchOptions";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";

export interface WidgetBuilderTitleState {
  builderTitle: string;
  setBuilderTitle: (builderTitle: string) => void;
}

export interface WidgetBuilderMetricState {
  builderCollection: CustomWidget["collection"];
  setBuilderCollection: (builderCollection: CustomWidget["collection"]) => void;
  builderOperation: CustomWidget["operation"];
  setBuilderOperation: (builderOperation: CustomWidget["operation"]) => void;
  builderTargetField: string;
  setBuilderTargetField: (builderTargetField: string) => void;
  builderFilterField: string;
  setBuilderFilterField: (builderFilterField: string) => void;
  builderFilterOperator: CustomWidget["filterOperator"];
  setBuilderFilterOperator: (builderFilterOperator: CustomWidget["filterOperator"]) => void;
  builderFilterValue: string;
  setBuilderFilterValue: (builderFilterValue: string) => void;
  builderColor: string;
  setBuilderColor: (builderColor: string) => void;
}

export interface WidgetBuilderThresholdState {
  thresholdEnabled: boolean;
  setThresholdEnabled: (thresholdEnabled: boolean) => void;
  thresholdCondition: "lt" | "gt" | "equals";
  setThresholdCondition: (thresholdCondition: "lt" | "gt" | "equals") => void;
  thresholdValue: string;
  setThresholdValue: (thresholdValue: string) => void;
  thresholdColor: "red" | "amber" | "yellow";
  setThresholdColor: (thresholdColor: "red" | "amber" | "yellow") => void;
}

export interface WidgetBuilderSwitchState {
  switchActionType: "app_setting" | "db_record";
  setSwitchActionType: (switchActionType: "app_setting" | "db_record") => void;
  switchStateKey: string;
  setSwitchStateKey: (switchStateKey: string) => void;
  switchCollection: CustomWidget["collection"];
  setSwitchCollection: (switchCollection: CustomWidget["collection"]) => void;
  switchRecordId: string;
  setSwitchRecordId: (switchRecordId: string) => void;
  switchLabelOn: string;
  setSwitchLabelOn: (switchLabelOn: string) => void;
  switchLabelOff: string;
  setSwitchLabelOff: (switchLabelOff: string) => void;
}

export interface WidgetBuilderCardState {
  builderIcon: string;
  setBuilderIcon: (builderIcon: string) => void;
  subTextType: "fixed" | "dynamic";
  setSubTextType: (subTextType: "fixed" | "dynamic") => void;
  fixedSubText: string;
  setFixedSubText: (fixedSubText: string) => void;
  trend: number;
  setTrend: (trend: number) => void;
  trendType: "manual" | "database";
  setTrendType: (trendType: "manual" | "database") => void;
  builderRole: string;
  setBuilderRole: (builderRole: string) => void;
}

export interface WidgetBuilderIconState {
  iconSearch: string;
  setIconSearch: (iconSearch: string) => void;
  activeIconTab: WidgetBuilderIconTab;
  setActiveIconTab: (activeIconTab: WidgetBuilderIconTab) => void;
}

export interface WidgetBuilderOptionsPanelProps {
  mode: "dashboard" | "kpi";
  widgetType: CustomWidget["widgetType"];
  setWidgetType: (widgetType: CustomWidget["widgetType"]) => void;
  titleState: WidgetBuilderTitleState;
  metricState: WidgetBuilderMetricState;
  thresholdState: WidgetBuilderThresholdState;
  switchState: WidgetBuilderSwitchState;
  cardState: WidgetBuilderCardState;
  iconState: WidgetBuilderIconState;
  dbRecordsList: SwitchRecordOption[];
}

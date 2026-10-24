import { useEffect } from "react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";

interface UseWidgetBuilderHydrationOptions {
  editWidgetConfig: CustomWidget | null;
  initialCollection: CustomWidget["collection"];
  t: TranslationFunction;
  setWidgetType: (value: CustomWidget["widgetType"]) => void;
  setBuilderTitle: (value: string) => void;
  setBuilderCollection: (value: CustomWidget["collection"]) => void;
  setBuilderOperation: (value: CustomWidget["operation"]) => void;
  setBuilderTargetField: (value: string) => void;
  setBuilderFilterField: (value: string) => void;
  setBuilderFilterOperator: (value: CustomWidget["filterOperator"]) => void;
  setBuilderFilterValue: (value: string) => void;
  setBuilderColor: (value: string) => void;
  setThresholdEnabled: (value: boolean) => void;
  setThresholdCondition: (value: "lt" | "gt" | "equals") => void;
  setThresholdValue: (value: string) => void;
  setThresholdColor: (value: "red" | "amber" | "yellow") => void;
  setSwitchActionType: (value: "app_setting" | "db_record") => void;
  setSwitchStateKey: (value: string) => void;
  setSwitchCollection: (value: CustomWidget["collection"]) => void;
  setSwitchRecordId: (value: string) => void;
  setSwitchField: (value: string) => void;
  setSwitchLabelOn: (value: string) => void;
  setSwitchLabelOff: (value: string) => void;
  setBuilderIcon: (value: string) => void;
  setSubTextType: (value: "fixed" | "dynamic") => void;
  setFixedSubText: (value: string) => void;
  setTrend: (value: number) => void;
  setTrendType: (value: "manual" | "database") => void;
  setBuilderRole: (value: string) => void;
}

export function useWidgetBuilderHydration({
  editWidgetConfig,
  initialCollection,
  t,
  setWidgetType,
  setBuilderTitle,
  setBuilderCollection,
  setBuilderOperation,
  setBuilderTargetField,
  setBuilderFilterField,
  setBuilderFilterOperator,
  setBuilderFilterValue,
  setBuilderColor,
  setThresholdEnabled,
  setThresholdCondition,
  setThresholdValue,
  setThresholdColor,
  setSwitchActionType,
  setSwitchStateKey,
  setSwitchCollection,
  setSwitchRecordId,
  setSwitchField,
  setSwitchLabelOn,
  setSwitchLabelOff,
  setBuilderIcon,
  setSubTextType,
  setFixedSubText,
  setTrend,
  setTrendType,
  setBuilderRole,
}: UseWidgetBuilderHydrationOptions): void {
  useEffect(() => {
    if (editWidgetConfig) {
      setWidgetType(editWidgetConfig.widgetType || "kpi");
      setBuilderTitle(editWidgetConfig.title);
      setBuilderCollection(editWidgetConfig.collection);
      setBuilderOperation(editWidgetConfig.operation);
      setBuilderTargetField(editWidgetConfig.targetField || "");
      setBuilderFilterField(editWidgetConfig.filterField || "");
      setBuilderFilterOperator(editWidgetConfig.filterOperator || "equals");
      setBuilderFilterValue(editWidgetConfig.filterValue || "");
      setBuilderColor(editWidgetConfig.color || "emerald");
      setThresholdEnabled(!!editWidgetConfig.thresholdEnabled);
      setThresholdCondition(editWidgetConfig.thresholdCondition || "lt");
      setThresholdValue(
        editWidgetConfig.thresholdValue !== undefined
          ? String(editWidgetConfig.thresholdValue)
          : "",
      );
      setThresholdColor(editWidgetConfig.thresholdColor || "red");
      setSwitchActionType(editWidgetConfig.switchActionType || "app_setting");
      setSwitchStateKey(editWidgetConfig.switchStateKey || "app_setting_attendance_lock");
      setSwitchCollection(editWidgetConfig.switchCollection || initialCollection);
      setSwitchRecordId(editWidgetConfig.switchRecordId || "");
      setSwitchField(editWidgetConfig.switchField || "status");
      setSwitchLabelOn(editWidgetConfig.switchLabelOn || t("reports.widgets.statusOn"));
      setSwitchLabelOff(editWidgetConfig.switchLabelOff || t("reports.widgets.statusOff"));
      setBuilderIcon(editWidgetConfig.icon || "GraduationCap");
      setSubTextType(editWidgetConfig.subTextType || "dynamic");
      setFixedSubText(editWidgetConfig.fixedSubText || "");
      setTrend(editWidgetConfig.trend || 0);
      setTrendType(editWidgetConfig.trendType || "database");
      setBuilderRole(editWidgetConfig.role || "admin");
    } else {
      setWidgetType("kpi");
      setBuilderTitle("");
      setBuilderCollection(initialCollection);
      setBuilderOperation("count");
      setBuilderTargetField("");
      setBuilderFilterField("");
      setBuilderFilterOperator("equals");
      setBuilderFilterValue("");
      setBuilderColor("emerald");
      setThresholdEnabled(false);
      setThresholdValue("");
      setSwitchActionType("app_setting");
      setSwitchStateKey("app_setting_attendance_lock");
      setSwitchCollection(initialCollection);
      setSwitchRecordId("");
      setSwitchLabelOn(t("reports.widgets.statusOn"));
      setSwitchLabelOff(t("reports.widgets.statusOff"));
      setBuilderIcon("GraduationCap");
      setSubTextType("dynamic");
      setFixedSubText("");
      setTrend(0);
      setTrendType("database");
      setBuilderRole("admin");
    }
  }, [
    editWidgetConfig,
    initialCollection,
    t,
    setWidgetType,
    setBuilderTitle,
    setBuilderCollection,
    setBuilderOperation,
    setBuilderTargetField,
    setBuilderFilterField,
    setBuilderFilterOperator,
    setBuilderFilterValue,
    setBuilderColor,
    setThresholdEnabled,
    setThresholdCondition,
    setThresholdValue,
    setThresholdColor,
    setSwitchActionType,
    setSwitchStateKey,
    setSwitchCollection,
    setSwitchRecordId,
    setSwitchField,
    setSwitchLabelOn,
    setSwitchLabelOff,
    setBuilderIcon,
    setSubTextType,
    setFixedSubText,
    setTrend,
    setTrendType,
    setBuilderRole,
  ]);
}

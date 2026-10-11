import { useState, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { METADATA_FIELDS } from "@/lib/reports/reportMetadata";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { useWidgetCollections } from "@/lib/reports/useReportCollections";
import type { ReportCollection } from "@/lib/reports/reportMetadata";
import { type WidgetBuilderIconTab } from "@/components/ui/reports/pinnedWidgets/WidgetBuilderCardOptions";
import { useWidgetBuilderRecordOptions } from "@/components/ui/reports/pinnedWidgets/useWidgetBuilderRecordOptions";
import {
  buildWidgetBuilderPreview,
  buildWidgetSavePayload,
} from "@/components/ui/reports/pinnedWidgets/widgetBuilderStateHelpers";
import { useWidgetBuilderHydration } from "@/components/ui/reports/pinnedWidgets/useWidgetBuilderHydration";

interface UseWidgetBuilderStateOptions {
  initialCollection: CustomWidget["collection"];
  editWidgetConfig: CustomWidget | null;
  category?: string;
  mode?: "dashboard" | "kpi";
  initialWidgetType?: CustomWidget["widgetType"];
  onSaveWidget: (widget: CustomWidget) => void;
}

export function useWidgetBuilderState({
  initialCollection,
  editWidgetConfig,
  category = "students",
  mode = "kpi",
  initialWidgetType = "kpi",
  onSaveWidget,
}: UseWidgetBuilderStateOptions) {
  const { t } = useTranslation();

  const [widgetType, setWidgetType] = useState<CustomWidget["widgetType"]>(() => {
    if (editWidgetConfig) return editWidgetConfig.widgetType || "kpi";
    return initialWidgetType || "kpi";
  });
  const [builderTitle, setBuilderTitle] = useState("");
  const [builderCollection, setBuilderCollection] =
    useState<CustomWidget["collection"]>(initialCollection);
  const [builderOperation, setBuilderOperation] = useState<CustomWidget["operation"]>("count");
  const [builderTargetField, setBuilderTargetField] = useState("");
  const [builderFilterField, setBuilderFilterField] = useState("");
  const [builderFilterOperator, setBuilderFilterOperator] =
    useState<CustomWidget["filterOperator"]>("equals");
  const [builderFilterValue, setBuilderFilterValue] = useState("");
  const [builderColor, setBuilderColor] = useState("emerald");
  const [thresholdEnabled, setThresholdEnabled] = useState(false);
  const [thresholdCondition, setThresholdCondition] = useState<"lt" | "gt" | "equals">("lt");
  const [thresholdValue, setThresholdValue] = useState("");
  const [thresholdColor, setThresholdColor] = useState<"red" | "amber" | "yellow">("red");
  const [switchActionType, setSwitchActionType] = useState<"app_setting" | "db_record">(
    "app_setting",
  );
  const [switchStateKey, setSwitchStateKey] = useState("app_setting_attendance_lock");
  const [switchCollection, setSwitchCollection] = useState<CustomWidget["collection"]>("students");
  const [switchRecordId, setSwitchRecordId] = useState("");
  const [switchField, setSwitchField] = useState("status");
  const [switchLabelOn, setSwitchLabelOn] = useState("");
  const [switchLabelOff, setSwitchLabelOff] = useState("");
  const [builderIcon, setBuilderIcon] = useState("GraduationCap");
  const [subTextType, setSubTextType] = useState<"fixed" | "dynamic">("dynamic");
  const [fixedSubText, setFixedSubText] = useState("");
  const [trend, setTrend] = useState<number>(0);
  const [trendType, setTrendType] = useState<"manual" | "database">("database");
  const [builderRole, setBuilderRole] = useState("admin");
  const [iconSearch, setIconSearch] = useState("");
  const [activeIconTab, setActiveIconTab] = useState<WidgetBuilderIconTab>("all");
  const [scalerSize, setScalerSize] = useState(180);

  const requiredCollections = (() => {
    const required = new Set<ReportCollection>([builderCollection]);
    if (widgetType === "switch" && switchActionType === "db_record") {
      required.add(switchCollection);
    }
    return required;
  })();
  const collections = useWidgetCollections({ requiredCollections });

  useWidgetBuilderHydration({
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
  });

  const dbRecordsList = useWidgetBuilderRecordOptions({
    collections,
    switchCollection,
    switchRecordId,
    setSwitchRecordId,
  });

  useEffect(() => {
    if (editWidgetConfig && editWidgetConfig.collection === builderCollection) return;
    const meta = METADATA_FIELDS[builderCollection];
    if (!meta) return;
    const firstField = meta.fields[0];
    setBuilderFilterField(firstField ? firstField.value : "");
    const firstNumField = meta.numericFields[0];
    setBuilderTargetField(firstNumField ? firstNumField.value : "");
  }, [builderCollection, editWidgetConfig]);

  const previewWidget = (() =>
    buildWidgetBuilderPreview(
      editWidgetConfig,
      category,
      builderTitle,
      builderCollection,
      widgetType,
      builderOperation,
      builderTargetField,
      builderFilterField,
      builderFilterOperator,
      builderFilterValue,
      builderColor,
      thresholdEnabled,
      thresholdCondition,
      thresholdValue,
      thresholdColor,
      switchActionType,
      switchStateKey,
      switchCollection,
      switchRecordId,
      switchField,
      switchLabelOn,
      switchLabelOff,
      builderIcon,
      subTextType,
      fixedSubText,
      trend,
      trendType,
      builderRole,
      t("reports.widgets.customLiveWidget"),
    ))() as CustomWidget;

  const handleSaveWidget = () => {
    onSaveWidget(
      buildWidgetSavePayload(
        editWidgetConfig,
        category,
        mode,
        builderTitle,
        builderCollection,
        widgetType,
        builderOperation,
        builderTargetField,
        builderFilterField,
        builderFilterOperator,
        builderFilterValue,
        builderColor,
        thresholdEnabled,
        thresholdCondition,
        thresholdValue,
        thresholdColor,
        switchActionType,
        switchStateKey,
        switchCollection,
        switchRecordId,
        switchField,
        switchLabelOn,
        switchLabelOff,
        builderIcon,
        subTextType,
        fixedSubText,
        trend,
        trendType,
        builderRole,
      ),
    );
  };

  return {
    collections,
    widgetType,
    setWidgetType,
    scalerSize,
    setScalerSize,
    previewWidget,
    handleSaveWidget,
    canSave: Boolean(builderTitle),
    dbRecordsList,
    titleState: { builderTitle, setBuilderTitle },
    metricState: {
      builderCollection,
      setBuilderCollection,
      builderOperation,
      setBuilderOperation,
      builderTargetField,
      setBuilderTargetField,
      builderFilterField,
      setBuilderFilterField,
      builderFilterOperator,
      setBuilderFilterOperator,
      builderFilterValue,
      setBuilderFilterValue,
      builderColor,
      setBuilderColor,
    },
    thresholdState: {
      thresholdEnabled,
      setThresholdEnabled,
      thresholdCondition,
      setThresholdCondition,
      thresholdValue,
      setThresholdValue,
      thresholdColor,
      setThresholdColor,
    },
    switchState: {
      switchActionType,
      setSwitchActionType,
      switchStateKey,
      setSwitchStateKey,
      switchCollection,
      setSwitchCollection,
      switchRecordId,
      setSwitchRecordId,
      switchLabelOn,
      setSwitchLabelOn,
      switchLabelOff,
      setSwitchLabelOff,
    },
    cardState: {
      builderIcon,
      setBuilderIcon,
      subTextType,
      setSubTextType,
      fixedSubText,
      setFixedSubText,
      trend,
      setTrend,
      trendType,
      setTrendType,
      builderRole,
      setBuilderRole,
    },
    iconState: { iconSearch, setIconSearch, activeIconTab, setActiveIconTab },
  };
}

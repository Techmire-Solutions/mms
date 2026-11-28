import { useCallback, useState } from "react";
import { findDuplicateDashboardWidget } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { notify } from "@mms/fe-core/notify";
import type { CustomWidget } from "../../lib/pinnedWidgetTypes";
import { useWidgetCollections } from "../../lib/useReportCollections";
import type { ReportCollection } from "../../lib/reportMetadata";
import { type WidgetBuilderIconTab } from "./WidgetBuilderCardOptions";
import { useWidgetBuilderRecordOptions } from "./useWidgetBuilderRecordOptions";
import { buildWidgetBuilderPreview, buildWidgetSavePayload } from "./widgetBuilderStateHelpers";
import { useWidgetBuilderHydration } from "./useWidgetBuilderHydration";
import {
  initialFilterField,
  initialTargetField,
  useWidgetBuilderCollectionDefaults,
} from "./useWidgetBuilderCollectionDefaults";

interface UseWidgetBuilderStateOptions {
  initialCollection: CustomWidget["collection"];
  editWidgetConfig: CustomWidget | null;
  category?: string;
  mode?: "dashboard" | "kpi";
  initialWidgetType?: CustomWidget["widgetType"];
  onSaveWidget: (widget: CustomWidget) => void | Promise<void>;
  existingWidgets?: CustomWidget[];
}

export function useWidgetBuilderState({
  initialCollection,
  editWidgetConfig,
  category = "students",
  mode = "kpi",
  initialWidgetType = "kpi",
  onSaveWidget,
  existingWidgets = [],
}: UseWidgetBuilderStateOptions) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [widgetType, setWidgetType] = useState<CustomWidget["widgetType"]>(() => {
    if (editWidgetConfig) return editWidgetConfig.widgetType || "kpi";
    return initialWidgetType || "kpi";
  });
  const [builderTitle, setBuilderTitle] = useState("");
  const [builderCollection, setBuilderCollection] =
    useState<CustomWidget["collection"]>(initialCollection);
  const [builderOperation, setBuilderOperation] = useState<CustomWidget["operation"]>("count");
  const [builderTargetField, setBuilderTargetField] = useState(() =>
    initialTargetField(initialCollection, editWidgetConfig),
  );
  const [builderFilterField, setBuilderFilterField] = useState(() =>
    initialFilterField(initialCollection, editWidgetConfig),
  );
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

  // `useWidgetBuilderHydration` clears these two drafts when it re-hydrates a fresh
  // builder, but the collection defaults below own the empty case, so only forward
  // hydrated values while editing an existing widget.
  const hydrateFilterField = useCallback(
    (value: string) => {
      if (editWidgetConfig) setBuilderFilterField(value);
    },
    [editWidgetConfig],
  );
  const hydrateTargetField = useCallback(
    (value: string) => {
      if (editWidgetConfig) setBuilderTargetField(value);
    },
    [editWidgetConfig],
  );

  useWidgetBuilderHydration({
    editWidgetConfig,
    initialCollection,
    t,
    setWidgetType,
    setBuilderTitle,
    setBuilderCollection,
    setBuilderOperation,
    setBuilderTargetField: hydrateTargetField,
    setBuilderFilterField: hydrateFilterField,
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

  useWidgetBuilderCollectionDefaults({
    collection: builderCollection,
    editWidgetConfig,
    setBuilderTargetField,
    setBuilderFilterField,
  });
  const previewWidget = (() =>
    buildWidgetBuilderPreview(
      editWidgetConfig,
      category,
      builderTitle.trim(),
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
  const handleSaveWidget = async (): Promise<void> => {
    if (saving) return;
    setSaveError(null);
    if (!builderTitle.trim()) return setSaveError(t("reports.widgets.builder.labelTitle"));
    if (["sum", "avg"].includes(builderOperation) && !builderTargetField)
      return setSaveError(t("reports.widgets.builder.targetField"));
    const widget = buildWidgetSavePayload(
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
    );
    const duplicate = findDuplicateDashboardWidget(widget, existingWidgets);
    if (duplicate) {
      const errorMsg = t("reports.widgets.builder.duplicateWidget");
      setSaveError(errorMsg);
      notify.error(errorMsg);
      return;
    }
    setSaving(true);
    try {
      await onSaveWidget(widget);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("settings.serverSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return {
    collections,
    widgetType,
    setWidgetType,
    scalerSize,
    setScalerSize,
    previewWidget,
    handleSaveWidget,
    canSave: Boolean(builderTitle.trim()) && !saving,
    saving,
    saveError,
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
      switchField,
      setSwitchField,
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

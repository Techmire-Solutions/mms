import React from "react";
import { FORM_INPUT_BUILDER } from "@/components/ui/formStyles";
import { Field } from "@/components/app/FormField";
import { Input } from "@/components/ui/input";
import { isListSummaryWidgetType } from "@/components/dashboard-widgets/registry";
import { useTranslation } from "@/hooks/useTranslation";
import {
  WidgetBuilderCardRoleOptions,
  WidgetBuilderCardTextOptions,
  WidgetBuilderIconPicker,
} from "@/components/reports/pinnedWidgets/WidgetBuilderCardOptions";
import { WidgetBuilderColorOptions } from "@/components/reports/pinnedWidgets/WidgetBuilderColorOptions";
import { WidgetBuilderMetricOptions } from "@/components/reports/pinnedWidgets/WidgetBuilderMetricOptions";
import { WidgetBuilderSwitchOptions } from "@/components/reports/pinnedWidgets/WidgetBuilderSwitchOptions";
import { WidgetBuilderThresholdOptions } from "@/components/reports/pinnedWidgets/WidgetBuilderThresholdOptions";
import { WidgetBuilderTypeSelector } from "@/components/reports/pinnedWidgets/WidgetBuilderTypeSelector";
import type { WidgetBuilderOptionsPanelProps } from "@/components/reports/pinnedWidgets/widgetBuilderOptionsPanelTypes";

export function WidgetBuilderOptionsPanel({
  mode,
  widgetType,
  setWidgetType,
  titleState,
  metricState,
  thresholdState,
  switchState,
  cardState,
  iconState,
  dbRecordsList,
}: WidgetBuilderOptionsPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const { builderTitle, setBuilderTitle } = titleState;
  const {
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
  } = metricState;
  const {
    thresholdEnabled,
    setThresholdEnabled,
    thresholdCondition,
    setThresholdCondition,
    thresholdValue,
    setThresholdValue,
    thresholdColor,
    setThresholdColor,
  } = thresholdState;
  const {
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
  } = switchState;
  const {
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
  } = cardState;
  const { iconSearch, setIconSearch, activeIconTab, setActiveIconTab } = iconState;
  const usesMetricOptions = widgetType !== "switch" && !isListSummaryWidgetType(widgetType);

  return (
    <div className="lg:col-span-2 space-y-4">
      <WidgetBuilderTypeSelector
        builderCollection={builderCollection}
        widgetType={widgetType}
        setWidgetType={setWidgetType}
        setBuilderOperation={setBuilderOperation}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label={t("reports.widgets.builder.labelTitle")} id="widget-builder-title">
          <Input
            id="widget-builder-title"
            name="widgetTitle"
            type="text"
            value={builderTitle}
            onChange={(event) => setBuilderTitle(event.target.value)}
            placeholder={t("reports.widgets.builder.placeholderTitle")}
            className={FORM_INPUT_BUILDER}
          />
        </Field>

        {widgetType === "card" && mode === "dashboard" && (
          <WidgetBuilderCardRoleOptions builderRole={builderRole} setBuilderRole={setBuilderRole} />
        )}

        {usesMetricOptions ? (
          <WidgetBuilderMetricOptions
            builderCollection={builderCollection}
            setBuilderCollection={setBuilderCollection}
            builderOperation={builderOperation}
            setBuilderOperation={setBuilderOperation}
            builderTargetField={builderTargetField}
            setBuilderTargetField={setBuilderTargetField}
            builderFilterField={builderFilterField}
            setBuilderFilterField={setBuilderFilterField}
            builderFilterOperator={builderFilterOperator}
            setBuilderFilterOperator={setBuilderFilterOperator}
            builderFilterValue={builderFilterValue}
            setBuilderFilterValue={setBuilderFilterValue}
          >
            {widgetType === "card" && (
              <WidgetBuilderCardTextOptions
                subTextType={subTextType}
                setSubTextType={setSubTextType}
                fixedSubText={fixedSubText}
                setFixedSubText={setFixedSubText}
                trend={trend}
                setTrend={setTrend}
                trendType={trendType}
                setTrendType={setTrendType}
              />
            )}
          </WidgetBuilderMetricOptions>
        ) : (
          <WidgetBuilderSwitchOptions
            switchActionType={switchActionType}
            setSwitchActionType={setSwitchActionType}
            switchStateKey={switchStateKey}
            setSwitchStateKey={setSwitchStateKey}
            switchCollection={switchCollection}
            setSwitchCollection={setSwitchCollection}
            switchRecordId={switchRecordId}
            setSwitchRecordId={setSwitchRecordId}
            switchLabelOn={switchLabelOn}
            setSwitchLabelOn={setSwitchLabelOn}
            switchLabelOff={switchLabelOff}
            setSwitchLabelOff={setSwitchLabelOff}
            dbRecordsList={dbRecordsList}
          />
        )}
      </div>

      {usesMetricOptions && (
        <WidgetBuilderThresholdOptions
          thresholdEnabled={thresholdEnabled}
          setThresholdEnabled={setThresholdEnabled}
          thresholdCondition={thresholdCondition}
          setThresholdCondition={setThresholdCondition}
          thresholdValue={thresholdValue}
          setThresholdValue={setThresholdValue}
          thresholdColor={thresholdColor}
          setThresholdColor={setThresholdColor}
        />
      )}

      <WidgetBuilderColorOptions builderColor={builderColor} setBuilderColor={setBuilderColor} />

      {widgetType === "card" && (
        <WidgetBuilderIconPicker
          builderIcon={builderIcon}
          setBuilderIcon={setBuilderIcon}
          iconSearch={iconSearch}
          setIconSearch={setIconSearch}
          activeIconTab={activeIconTab}
          setActiveIconTab={setActiveIconTab}
        />
      )}
    </div>
  );
}

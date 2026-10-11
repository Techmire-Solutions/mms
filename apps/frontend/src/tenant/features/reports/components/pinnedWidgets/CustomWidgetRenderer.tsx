import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveWidgetTitle, resolveWidgetSubText } from "@/lib/dashboardWidgets";
import { COMPOSED_WIDGET_TYPES } from "@/components/dashboard-widgets/registry";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { resolveThresholdChartHex, resolveWidgetChartHex } from "@/lib/brandingChartPalette";
import { computeCustomCard, type CustomCard } from "@/lib/reports/reportMetadata";
import { readDashboardSwitchState } from "@/tenant/features/reports/components/pinnedWidgets/useDashboardSectionSettings";
import { type ReportCollectionsSnapshot } from "@/lib/reports/useReportCollections";
import { type CustomWidget, ALERT_COLOR_MAP } from "@/lib/reports/pinnedWidgetTypes";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  computeWidgetSingleValue,
  computeContactsCustomCardValue,
  computeStudentsCustomCardValue,
  computeFacultyCustomCardValue,
  computeSessionsCustomCardValue,
  computeEnrollmentsCustomCardValue,
} from "@/lib/reports/widgetDataUtils";
import { CustomWidgetCompactLayout } from "@/components/ui/reports/pinnedWidgets/CustomWidgetCompactLayout";
import { CustomWidgetComfortableLayout } from "@/components/ui/reports/pinnedWidgets/CustomWidgetComfortableLayout";

export { WidgetDrilldownModal } from "@/components/ui/reports/pinnedWidgets/WidgetDrilldownModal";

/**
 * Render interface resolving dynamic card visualizations.
 */
export function CustomWidgetRenderer({
  widget,
  collections,
  isCompact,
  isEditMode = false,
  onSwitchToggle,
  onMetricClick,
}: {
  widget: CustomWidget;
  collections: ReportCollectionsSnapshot;
  isCompact?: boolean;
  isEditMode?: boolean;
  onSwitchToggle: (widget: CustomWidget) => void;
  onMetricClick: (widget: CustomWidget) => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const palette = useBrandPalette();

  const resolvedWidgetType = (() => {
    const type = widget.widgetType || "";
    if (
      ["bar", "line", "area", "pie", "radar"].includes(type) ||
      ["bar", "line", "area", "pie", "radar"].includes(widget.chartType || "")
    ) {
      return "chart";
    }
    const knownTypes = ["kpi", "progress", "switch", "card", ...COMPOSED_WIDGET_TYPES];
    if (knownTypes.includes(type)) {
      return type;
    }
    return "kpi";
  })();

  const { value, formattedValue, isAlert } = (() => {
    if (resolvedWidgetType === "card") {
      return { value: 0, formattedValue: "", isAlert: false };
    }
    return computeWidgetSingleValue(widget, collections);
  })();

  const isSwitchOn = (() => {
    if (resolvedWidgetType === "card") return false;
    if (widget.switchActionType === "app_setting") {
      return readDashboardSwitchState(widget.switchStateKey || "");
    }
    const collectionName = widget.switchCollection;
    const recordId = widget.switchRecordId;
    const targetField = widget.switchField || "status";
    if (!collectionName || !recordId) return false;
    const collectionRecords = (collections[collectionName] || []) as unknown[];
    const matchedRecord = collectionRecords.find((candidate) => {
      const record = candidate as Record<string, unknown>;
      return record && String(record.id) === String(recordId);
    });
    if (!matchedRecord) return false;
    const fieldValue = (matchedRecord as Record<string, unknown>)[targetField];
    return String(fieldValue) === "active" || String(fieldValue) === "paid" || !!fieldValue;
  })();

  const computedCard = (() => {
    if (resolvedWidgetType !== "card") return null;

    const card: CustomCard = Object.assign(
      { operation: "count" as const, color: "blue", icon: "star", subTextType: "dynamic" as const },
      widget,
    );
    const serverComputed = computeServerBackedCard(card, t);

    return (
      serverComputed ??
      computeCustomCard(card, {
        ...collections,
        students: [],
        faculty: [],
        contacts: [],
      })
    );
  })();

  const colorHex = isAlert
    ? resolveThresholdChartHex(widget.thresholdColor, palette)
    : resolveWidgetChartHex(widget.color, palette);

  const alertScheme = isAlert ? ALERT_COLOR_MAP[widget.thresholdColor || "red"] : null;

  const switchLabel = isSwitchOn
    ? widget.switchLabelOnKey
      ? t(widget.switchLabelOnKey)
      : widget.switchLabelOn || t("reports.widgets.statusOn")
    : widget.switchLabelOffKey
      ? t(widget.switchLabelOffKey)
      : widget.switchLabelOff || t("reports.widgets.statusOff");

  if (isCompact && resolvedWidgetType !== "chart") {
    return (
      <CustomWidgetCompactLayout
        widget={widget}
        resolvedWidgetType={resolvedWidgetType}
        computedCard={computedCard}
        formattedValue={formattedValue}
        value={value}
        colorHex={colorHex}
        alertScheme={alertScheme}
        isSwitchOn={isSwitchOn}
        switchLabel={switchLabel}
        onSwitchToggle={onSwitchToggle}
        onMetricClick={onMetricClick}
        t={t}
      />
    );
  }

  return (
    <CustomWidgetComfortableLayout
      widget={widget}
      collections={collections}
      resolvedWidgetType={resolvedWidgetType}
      computedCard={computedCard}
      formattedValue={formattedValue}
      value={value}
      colorHex={colorHex}
      alertScheme={alertScheme}
      isAlert={isAlert}
      isSwitchOn={isSwitchOn}
      switchLabel={switchLabel}
      isEditMode={isEditMode}
      onSwitchToggle={onSwitchToggle}
      onMetricClick={onMetricClick}
      t={t}
    />
  );
}

type ServerCardAggregate = ReturnType<typeof computeContactsCustomCardValue>;
type ComputedCustomCard = ReturnType<typeof computeCustomCard>;

const SERVER_CARD_COMPUTERS = {
  contacts: computeContactsCustomCardValue,
  students: computeStudentsCustomCardValue,
  faculty: computeFacultyCustomCardValue,
  sessions: computeSessionsCustomCardValue,
  enrollments: computeEnrollmentsCustomCardValue,
} as const;

function computeServerBackedCard(
  card: CustomCard,
  t: TranslationFunction,
): ComputedCustomCard | null {
  const aggregateValue = getServerCardAggregate(card);
  if (!aggregateValue) return null;

  return {
    id: card.id,
    title: resolveWidgetTitle(card, t),
    value: String(aggregateValue.finalValue),
    sub:
      resolveWidgetSubText(card, t) ||
      t("reports.widgets.totalCountText", { count: aggregateValue.totalCount }),
    icon: card.icon,
    color: card.color,
    trend: card.trend || 0,
  };
}

function getServerCardAggregate(card: CustomCard): ServerCardAggregate {
  const computeFn = SERVER_CARD_COMPUTERS[card.collection as keyof typeof SERVER_CARD_COMPUTERS];
  if (!computeFn) return null;

  return computeFn({
    id: card.id,
    operation: card.operation,
    targetField: card.targetField,
    filterField: card.filterField,
    filterOperator: card.filterOperator,
    filterValue: card.filterValue,
  });
}

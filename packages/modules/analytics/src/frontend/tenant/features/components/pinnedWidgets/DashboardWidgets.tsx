import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { toggleDashboardSwitchState } from "./useDashboardSectionSettings";
import { isRestWidgetCollection, persistWidgetRecordToggle } from "../../../lib/widgetRecordToggle";
import { useWidgetCollections } from "../../../lib/useReportCollections";
import type { ReportCollection } from "../../../lib/reportMetadata";
import type { CustomWidget } from "../../../lib/pinnedWidgetTypes";
import { useDashboardConfig } from "../../../host/useDashboardConfig";
import { WidgetDrilldownModal, CustomWidgetRenderer } from "./CustomWidgetRenderer";
import { reportClientError } from "@mms/fe-core/reporting/clientErrorReporting";
import { useContactsWidgetAggregates } from "../../../host/collections";
import { useStudentsWidgetAggregates } from "../../../host/collections";
import { useFacultyWidgetAggregates } from "../../../host/collections";
import { useSessionsWidgetAggregates } from "../../../host/collections";
import { useEnrollmentsWidgetAggregates } from "../../../host/collections";
import { applyContactsWidgetWorkDrillDown } from "../../../host/reportLibs";
import { notify } from "@mms/fe-core/notify";
import { useTranslation } from "@mms/fe-core/i18n";
import { DashboardWidgetsHeader } from "../../../components/pinnedWidgets/DashboardWidgetsHeader";
import { DashboardWidgetsGrid } from "../../../components/pinnedWidgets/DashboardWidgetsGrid";

interface DashboardWidgetsProps {
  widgets?: CustomWidget[];
  /**
   * Canonical aggregate prefetch list (see `selectAggregateWidgets`). The host
   * passes the same list to every dashboard surface so the content-keyed
   * `/aggregates` queries dedupe into one request per collection.
   */
  aggregateWidgets?: CustomWidget[];
  onUnpin?: (id: string) => void;
  isEditMode?: boolean;
  onEditWidget?: (widget: CustomWidget) => void;
  onDeleteWidget?: (id: string) => void;
  /** Hide the section header when the parent already rendered one. */
  showHeader?: boolean;
}

/**
 * Pinned Custom Dashboard Widgets Section. Displays widgets with size controls.
 * Widgets + handlers are supplied by the caller (DashboardPage) from `useDashboardConfig`.
 */
export function DashboardWidgets({
  widgets,
  aggregateWidgets,
  onUnpin,
  isEditMode = false,
  onEditWidget,
  onDeleteWidget,
  showHeader = true,
}: DashboardWidgetsProps = {}): React.JSX.Element | null {
  const { t } = useTranslation();
  const { gridMode, updatePref, canPin } = useDashboardConfig();
  const [drilldownWidget, setDrilldownWidget] = useState<CustomWidget | null>(null);

  const activeWidgets = widgets ?? [];
  const requiredCollections = (() => {
    const required = new Set<ReportCollection>();
    for (const widget of activeWidgets) {
      required.add(widget.collection);
    }
    return required;
  })();
  const collections = useWidgetCollections({
    enabled: activeWidgets.length > 0,
    requiredCollections,
  });

  const aggregateSource = aggregateWidgets ?? activeWidgets;
  useContactsWidgetAggregates(aggregateSource);
  useStudentsWidgetAggregates(aggregateSource);
  useFacultyWidgetAggregates(aggregateSource);
  useSessionsWidgetAggregates(aggregateSource);
  useEnrollmentsWidgetAggregates(aggregateSource);

  const handleMetricClick = (widget: CustomWidget) => {
    if (applyContactsWidgetWorkDrillDown(widget)) return;
    setDrilldownWidget(widget);
  };

  const handleLocalUnpin = (id: string) => {
    onUnpin?.(id);
  };

  const handleToggleSwitchState = (widget: CustomWidget) => {
    if (widget.switchActionType === "app_setting") {
      toggleDashboardSwitchState(widget.switchStateKey || "");
      return;
    }

    const collectionName = widget.switchCollection;
    const recordId = widget.switchRecordId;
    const targetField = widget.switchField || "status";
    if (!collectionName || !recordId) return;
    if (!isRestWidgetCollection(collectionName)) {
      notify.error(t("reports.widgets.errorToggleFailed"));
      return;
    }
    void (async () => {
      try {
        await persistWidgetRecordToggle({
          collectionName,
          recordId: String(recordId),
          field: targetField,
        });
      } catch (error) {
        reportClientError(error, { context: "reports.widgetToggle" });
        notify.error(t("reports.widgets.errorToggleFailed"));
      }
    })();
  };

  if (activeWidgets.length === 0) return null;

  return (
    <div className="space-y-4 text-start font-sans mt-5">
      {showHeader ? (
        <DashboardWidgetsHeader
          gridMode={gridMode}
          onToggleGridMode={(mode: any) => updatePref("gridMode", mode)}
          canCustomize={canPin}
        />
      ) : null}

      <DashboardWidgetsGrid
        widgets={activeWidgets}
        gridMode={gridMode}
        isEditMode={isEditMode}
        onUnpin={handleLocalUnpin}
        onEditWidget={onEditWidget}
        onDeleteWidget={onDeleteWidget}
        renderWidget={(widget: any, isCompact: any) => (
          <CustomWidgetRenderer
            widget={widget}
            collections={collections}
            isCompact={isCompact}
            isEditMode={isEditMode}
            onSwitchToggle={handleToggleSwitchState}
            onMetricClick={handleMetricClick}
          />
        )}
      />

      <AnimatePresence>
        {drilldownWidget && (
          <WidgetDrilldownModal widget={drilldownWidget} onClose={() => setDrilldownWidget(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

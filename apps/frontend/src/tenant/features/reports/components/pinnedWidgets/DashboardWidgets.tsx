import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { toggleDashboardSwitchState } from "@/tenant/features/reports/components/pinnedWidgets/useDashboardSectionSettings";
import {
  isRestWidgetCollection,
  persistWidgetRecordToggle,
} from "@/lib/reports/widgetRecordToggle";
import { useWidgetCollections } from "@/lib/reports/useReportCollections";
import type { ReportCollection } from "@/lib/reports/reportMetadata";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import {
  WidgetDrilldownModal,
  CustomWidgetRenderer,
} from "@/tenant/features/reports/components/pinnedWidgets/CustomWidgetRenderer";
import { reportClientError } from "@/lib/clientErrorReporting";
import { useContactsWidgetAggregates } from "@/tenant/hooks/collections/contacts";
import { useStudentsWidgetAggregates } from "@/tenant/hooks/collections/students";
import { useFacultyWidgetAggregates } from "@/tenant/hooks/collections/faculty";
import { useSessionsWidgetAggregates } from "@/tenant/hooks/collections/sessions";
import { useEnrollmentsWidgetAggregates } from "@/tenant/hooks/collections/enrollments";
import { applyContactsWidgetWorkDrillDown } from "@/lib/contacts/contactsWidgetWorkDrillDown";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { DashboardWidgetsHeader } from "@/components/reports/pinnedWidgets/DashboardWidgetsHeader";
import { DashboardWidgetsGrid } from "@/components/reports/pinnedWidgets/DashboardWidgetsGrid";

interface DashboardWidgetsProps {
  widgets?: CustomWidget[];
  onUnpin?: (id: string) => void;
  isEditMode?: boolean;
  onEditWidget?: (widget: CustomWidget) => void;
  onDeleteWidget?: (id: string) => void;
}

/**
 * Pinned Custom Dashboard Widgets Section. Displays widgets with size controls.
 * Widgets + handlers are supplied by the caller (DashboardPage) from `useDashboardConfig`.
 */
export function DashboardWidgets({
  widgets,
  onUnpin,
  isEditMode = false,
  onEditWidget,
  onDeleteWidget,
}: DashboardWidgetsProps = {}): React.JSX.Element | null {
  const { t } = useTranslation();
  const { gridMode, updatePref } = useDashboardConfig();
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

  useContactsWidgetAggregates(activeWidgets);
  useStudentsWidgetAggregates(activeWidgets);
  useFacultyWidgetAggregates(activeWidgets);
  useSessionsWidgetAggregates(activeWidgets);
  useEnrollmentsWidgetAggregates(activeWidgets);

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
      <DashboardWidgetsHeader
        gridMode={gridMode}
        onToggleGridMode={(mode) => updatePref("gridMode", mode)}
      />

      <DashboardWidgetsGrid
        widgets={activeWidgets}
        gridMode={gridMode}
        collections={collections}
        isEditMode={isEditMode}
        onSwitchToggle={handleToggleSwitchState}
        onMetricClick={handleMetricClick}
        onUnpin={handleLocalUnpin}
        onEditWidget={onEditWidget}
        onDeleteWidget={onDeleteWidget}
        renderWidget={(widget, isCompact) => (
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

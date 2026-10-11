import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { getObject, saveObject } from "@/lib/db";
import {
  isRestWidgetCollection,
  persistWidgetRecordToggle,
} from "@/lib/reports/widgetRecordToggle";
import { useWidgetCollections } from "@/lib/reports/useReportCollections";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useContactsWidgetAggregates } from "@/tenant/hooks/collections/contacts";
import { useStudentsWidgetAggregates } from "@/tenant/hooks/collections/students";
import { useFacultyWidgetAggregates } from "@/tenant/hooks/collections/faculty";
import { useSessionsWidgetAggregates } from "@/tenant/hooks/collections/sessions";
import { useEnrollmentsWidgetAggregates } from "@/tenant/hooks/collections/enrollments";
import { notify } from "@/lib/notify";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
const DEFAULT_SECTION_SETTINGS: Record<string, boolean> = {
  enrollmentChart: true,
  revenueChart: true,
  attendanceChart: true,
  hasanatChart: true,
  sessionsTable: true,
  todayAttendance: true,
  feeSummary: true,
  outstandingFees: true,
  overdueObligations: true,
};
export function usePinnedWidgetsController(category: string) {
  const { t } = useTranslation();
  const {
    disabledCardIds,
    toggleCardVisibility,
    customWidgets: widgets,
    deleteWidget,
    toggleWidgetPin,
    saveWidget,
  } = useDashboardConfig();
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [sectionSettings, setSectionSettings] = useState<Record<string, boolean>>(() => {
    return getObject<Record<string, boolean>>(
      "dashboard_section_settings",
      DEFAULT_SECTION_SETTINGS,
    );
  });
  const normalizedCategory = (() => {
    if (category === "faculty") return "faculty";
    if (category === "finance" || category === "financial") return "financial";
    if (category === "academic" || category === "examinations") return "examinations";
    if (category === "question-bank" || category === "questionBank") return "questionBank";
    return category;
  })();
  const defaultCollection = (() => {
    if (normalizedCategory === "students") return "students";
    if (normalizedCategory === "contacts") return "contacts";
    if (normalizedCategory === "faculty") return "faculty";
    if (normalizedCategory === "attendance") return "attendance_records";
    if (normalizedCategory === "financial" || normalizedCategory === "accounting")
      return "finance_invoices";
    if (normalizedCategory === "hasanat") return "hasanat_distributions";
    if (normalizedCategory === "sessions") return "sessions";
    if (normalizedCategory === "enrollments") return "enrollments";
    if (normalizedCategory === "questionBank") return "questions";
    if (normalizedCategory === "examinations") return "assessment_results";
    return "students";
  })() as CustomWidget["collection"];
  const filteredWidgets = (() => {
    return widgets.filter((widget) => {
      const widgetCategory =
        widget.category === "faculty"
          ? "faculty"
          : widget.category === "finance"
            ? "financial"
            : widget.category === "academic"
              ? "examinations"
              : widget.category === "question-bank"
                ? "questionBank"
                : widget.category;
      return widgetCategory === normalizedCategory;
    });
  })();
  const requiredCollections = (() => {
    const required = new Set(filteredWidgets.map((widget) => widget.collection));
    return required;
  })();
  const collections = useWidgetCollections({
    enabled: filteredWidgets.length > 0,
    requiredCollections,
  });
  useContactsWidgetAggregates(filteredWidgets);
  useStudentsWidgetAggregates(filteredWidgets);
  useFacultyWidgetAggregates(filteredWidgets);
  useSessionsWidgetAggregates(filteredWidgets);
  useEnrollmentsWidgetAggregates(filteredWidgets);
  const toggleSectionSetting = (key: string) => {
    const nextSectionSettings = { ...sectionSettings, [key]: !sectionSettings[key] };
    setSectionSettings(nextSectionSettings);
    saveObject("dashboard_section_settings", nextSectionSettings);
    window.dispatchEvent(new Event("local-database-update"));
  };
  const handleDeleteWidget = (id: string) => {
    deleteWidget(id);
  };
  const handleTogglePin = (id: string) => {
    toggleWidgetPin(id);
  };
  const handleEditClick = (widget: CustomWidget) => {
    setEditingWidgetId(widget.id);
    setIsBuilderOpen(true);
  };
  const handleOpenCreateBuilder = () => {
    setEditingWidgetId(null);
    setIsBuilderOpen(true);
  };
  const handleToggleBuilder = () => {
    if (isBuilderOpen) {
      setIsBuilderOpen(false);
      setEditingWidgetId(null);
    } else {
      handleOpenCreateBuilder();
    }
  };
  const handleCancelBuilder = () => {
    setIsBuilderOpen(false);
    setEditingWidgetId(null);
  };
  const handleSaveWidget = async (savedWidget: CustomWidget) => {
    try {
      await saveWidget(savedWidget);
      setIsBuilderOpen(false);
      setEditingWidgetId(null);
    } catch {
      // onError already toasted; keep builder open for retry.
    }
  };
  const handleToggleSwitchStateLocal = (widget: CustomWidget) => {
    if (widget.switchActionType === "app_setting") {
      const switchStateKey = widget.switchStateKey || "";
      if (switchStateKey.startsWith("section_")) {
        const sectionKey = switchStateKey.replace("section_", "");
        const settings = getObject<Record<string, boolean>>("dashboard_section_settings", {});
        settings[sectionKey] = !settings[sectionKey];
        saveObject("dashboard_section_settings", settings);
      } else {
        const currentSwitchValue =
          getObject<unknown>(switchStateKey, false) === true ||
          getObject<unknown>(switchStateKey, "false") === "true";
        saveObject(switchStateKey, !currentSwitchValue);
      }
      window.dispatchEvent(new Event("local-database-update"));
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
      } catch {
        notify.error(t("reports.widgets.errorToggleFailed"));
      }
    })();
  };
  return {
    t,
    widgets,
    filteredWidgets,
    collections,
    disabledCardIds,
    toggleCardVisibility,
    sectionSettings,
    toggleSectionSetting,
    isBuilderOpen,
    editingWidgetId,
    defaultCollection,
    handleToggleBuilder,
    handleCancelBuilder,
    handleSaveWidget,
    handleDeleteWidget,
    handleTogglePin,
    handleEditClick,
    handleToggleSwitchStateLocal,
  };
}

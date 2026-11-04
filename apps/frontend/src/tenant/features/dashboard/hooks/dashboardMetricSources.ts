import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import {
  isDashboardAdmin,
  isDashboardAdminOrAccountant,
  isDashboardFaculty,
  type DashboardRole,
} from "@/lib/dashboardRole";
import {
  getRequiredDashboardCollections,
  filterDashboardWidgetsByCollection,
  isWidgetActiveForDashboard,
  DASHBOARD_ACCOUNTING_WIDGET_IDS,
} from "@/lib/dashboardCollections";
import { isSeededDashboardWidget } from "@/lib/dashboardWidgets";
import {
  ACCOUNTING_MODULE_MANIFEST,
  getModuleActionPermission,
  resolveAccessModuleId,
  type Permission,
} from "@mms/shared";

type AggregateCollection = "contacts" | "students" | "faculty" | "sessions";

export interface DashboardMetricSources {
  contacts: boolean;
  students: boolean;
  faculty: boolean;
  sessions: boolean;
  attendance: boolean;
  finance: boolean;
  hasanat: boolean;
  questionBank: boolean;
  accounting: boolean;
  /** Widgets that need a per-collection `/aggregates` request (non-KPI cards). */
  collectionWidgets: Record<AggregateCollection, CustomWidget[]>;
}

function needsWidgetAggregate(widget: CustomWidget): boolean {
  return widget.widgetType !== "card" || !isSeededDashboardWidget(widget.id);
}

/**
 * Pure decision table: which metric sources the dashboard may fetch for this
 * user, role, and enabled-module set. Extracted from the data hook so the
 * permission/enablement matrix is testable without rendering React.
 */
export function resolveDashboardMetricSources(input: {
  widgets: CustomWidget[];
  dashboardRole: DashboardRole;
  enabledModules?: Record<string, boolean | undefined>;
  can?: (permission: Permission) => boolean;
}): DashboardMetricSources {
  const { widgets, dashboardRole, enabledModules, can } = input;
  // `effectiveModules` is always fully populated (all-false while loading), so the
  // flags are the only authority here.
  const isModuleEnabled = (mod: string) => enabledModules?.[mod] !== false;
  // Same read permission the backend module gate enforces (shared policy).
  const canReadModule = (mod: string) => {
    const moduleId = resolveAccessModuleId(mod);
    return (
      isModuleEnabled(mod) &&
      (!can || (moduleId !== undefined && can(getModuleActionPermission(moduleId, "read"))))
    );
  };

  const requiredDashboardCollections = getRequiredDashboardCollections(
    widgets,
    dashboardRole,
    enabledModules,
    can,
  );

  return {
    contacts: requiredDashboardCollections.has("contacts") && canReadModule("contacts"),
    students:
      (requiredDashboardCollections.has("students") || isDashboardAdmin(dashboardRole)) &&
      canReadModule("students"),
    faculty: requiredDashboardCollections.has("faculty") && canReadModule("faculty"),
    // Role shell needs: faculty banner (sessions), admin/accountant notifications (finance + attendance).
    sessions:
      (requiredDashboardCollections.has("sessions") || isDashboardFaculty(dashboardRole)) &&
      canReadModule("sessions"),
    attendance:
      (requiredDashboardCollections.has("attendance_records") ||
        isDashboardAdminOrAccountant(dashboardRole) ||
        isDashboardFaculty(dashboardRole)) &&
      canReadModule("attendance"),
    finance:
      (requiredDashboardCollections.has("finance_invoices") ||
        isDashboardAdminOrAccountant(dashboardRole)) &&
      canReadModule("finance"),
    hasanat: requiredDashboardCollections.has("hasanat_distributions") && canReadModule("hasanat"),
    questionBank:
      (requiredDashboardCollections.has("questions") ||
        requiredDashboardCollections.has("tests") ||
        requiredDashboardCollections.has("assessment_results")) &&
      canReadModule("questionBank"),
    accounting:
      canReadModule("accounting") &&
      widgets.some(
        (w) =>
          isWidgetActiveForDashboard(w, dashboardRole) &&
          (w.category === ACCOUNTING_MODULE_MANIFEST.moduleId ||
            DASHBOARD_ACCOUNTING_WIDGET_IDS.has(w.id)),
      ),
    collectionWidgets: {
      contacts: filterDashboardWidgetsByCollection(widgets, "contacts", dashboardRole).filter(
        needsWidgetAggregate,
      ),
      students: filterDashboardWidgetsByCollection(widgets, "students", dashboardRole).filter(
        needsWidgetAggregate,
      ),
      faculty: filterDashboardWidgetsByCollection(widgets, "faculty", dashboardRole).filter(
        needsWidgetAggregate,
      ),
      sessions: filterDashboardWidgetsByCollection(widgets, "sessions", dashboardRole).filter(
        needsWidgetAggregate,
      ),
    },
  };
}

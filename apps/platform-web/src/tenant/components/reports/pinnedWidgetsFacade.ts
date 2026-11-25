/**
 * Shared Tenant Reports Facade.
 * Prevents direct cross-feature imports between feature modules and reports.
 */
export { default as PinnedWidgets } from "@/tenant/features/reports/components/PinnedWidgets";
export { CustomWidgetRenderer } from "@/tenant/features/reports/components/pinnedWidgets/CustomWidgetRenderer";
export { DashboardWidgets } from "@/tenant/features/reports/components/pinnedWidgets/DashboardWidgets";
export type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";

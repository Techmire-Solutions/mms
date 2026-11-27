/**
 * Shared Tenant Reports Facade.
 * Prevents direct cross-feature imports between feature modules and reports.
 */
export { default as PinnedWidgets } from "@mms/mod-analytics/frontend/tenant/features/components/PinnedWidgets";
export { CustomWidgetRenderer } from "@mms/mod-analytics/frontend/tenant/features/components/pinnedWidgets/CustomWidgetRenderer";
export { DashboardWidgets } from "@mms/mod-analytics/frontend/tenant/features/components/pinnedWidgets/DashboardWidgets";
export type { CustomWidget } from "@mms/mod-analytics/frontend/tenant/lib/pinnedWidgetTypes";

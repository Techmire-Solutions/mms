/**
 * Cross-module public surface for shared Reports tier shells.
 * Feature modules must import from here — not `@/tenant/features/reports/*`.
 */
export { default as KPISummary } from "@/tenant/features/reports/components/KPISummary";
export { default as ModuleReports } from "@/tenant/features/reports/components/ModuleReports";
export { ReportChartCard } from "@/components/reports/ReportChartCard";
export { ReportDataGridContainer } from "@/components/reports/ReportDataGridContainer";

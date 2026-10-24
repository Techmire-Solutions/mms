import { ReportChartCard } from '@/components/reports/ReportChartCard';
import type { ComponentProps } from 'react';

/** Shell-only example: supply localized title, actual aggregate data and chart
 * children. Lazy-load the chart implementation from its parent. Provide a
 * keyboard-accessible equivalent for interactive drill-down and never turn
 * missing/invalid numeric data into zero just to render a tooltip.
 */
export function ModuleReportCharts(props: ComponentProps<typeof ReportChartCard>) {
  return <ReportChartCard {...props} />;
}

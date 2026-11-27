import { getAnalyticsHost } from "../host.js";

export function registry() {
  return (getAnalyticsHost() as any).dashboardWidgetRegistry ?? {};
}

export const COMPOSED_WIDGET_TYPES = new Proxy(
  {},
  {
    get: (_t: any, k: any) => registry().COMPOSED_WIDGET_TYPES?.[k as string],
  },
);
export const isComposedWidgetType = (...a: any[]) => registry().isComposedWidgetType?.(...a);
export const isListSummaryWidgetType = (...a: any[]) => registry().isListSummaryWidgetType?.(...a);
export type ComposedDashboardWidget = any;

export const buildChartTooltip = (...a: any[]) => registry().buildChartTooltip?.(...a);

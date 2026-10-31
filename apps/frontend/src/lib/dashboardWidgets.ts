import type { AppTranslationKey, DashboardTrendMetric } from "@mms/shared";

/** Prefix for seeded default dashboard/report widgets (`widgetDefaults`). */
export const SEED_WIDGET_ID_PREFIX = "def-";

/** True when the widget id is a system-seeded default (not user-created). */
export function isSeededDashboardWidget(widgetId: string): boolean {
  return widgetId.startsWith(SEED_WIDGET_ID_PREFIX);
}

/** Minimal widget/card shape for title/subtitle resolution. */
export type WidgetI18nSource = {
  id: string;
  title: string;
  titleKey?: AppTranslationKey;
  fixedSubText?: string;
  fixedSubTextKey?: AppTranslationKey;
};

/** Dashboard metric stat item shape for grid and card rendering. */
export interface StatItem {
  id: string;
  title: string;
  value: string;
  sub: string;
  icon: string;
  color: string;
  trend: number;
}

/** Per-widget metadata for a seeded dashboard widget. SSOT for title/subtitle
 *  i18n keys and the explicit trend-metric source — replaces the former
 *  `DEFAULT_WIDGET_TITLE_KEYS` / `DEFAULT_WIDGET_SUBTEXT_KEYS` /
 *  `DASHBOARD_WIDGET_TREND_METRIC` parallel maps. */
export interface DashboardWidgetRegistryEntry {
  titleKey?: AppTranslationKey;
  subTextKey?: AppTranslationKey;
  trendMetric?: DashboardTrendMetric;
}

/** Seeded widget metadata registry — the single authority for seeded widget
 *  i18n keys and trend-metric mapping. Add new seeded widgets here once. */
export const DASHBOARD_WIDGET_REGISTRY: Record<string, DashboardWidgetRegistryEntry> = {
  "def-card-admin-students": {
    titleKey: "widget.title.totalStudents",
    subTextKey: "widget.subtitle.registeredStudents",
    trendMetric: "students",
  },
  "def-card-admin-attendance": {
    titleKey: "widget.title.attendanceToday",
    subTextKey: "widget.subtitle.attendanceRateToday",
    trendMetric: "attendance",
  },
  "def-card-admin-fees": {
    titleKey: "widget.title.feeCollection",
    subTextKey: "widget.subtitle.thisMonth",
    trendMetric: "fees",
  },
  "def-card-admin-outstanding": {
    titleKey: "widget.title.outstandingPayments",
    subTextKey: "widget.subtitle.unpaidInvoices",
    trendMetric: "outstanding",
  },
  "def-card-admin-hasanat": {
    titleKey: "widget.title.hasanatAwarded",
    subTextKey: "widget.subtitle.allTimePoints",
    trendMetric: "hasanat",
  },
  "def-card-admin-sessions": {
    titleKey: "widget.title.activeSessions",
    subTextKey: "widget.subtitle.activeSessions",
    trendMetric: "sessions",
  },
  "def-card-admin-classes": {
    titleKey: "widget.title.activeClasses",
    subTextKey: "widget.subtitle.allActiveClasses",
    trendMetric: "sessions",
  },
  "def-card-admin-contacts": {
    titleKey: "widget.title.totalContacts",
    subTextKey: "widget.subtitle.totalContacts",
    trendMetric: "contacts",
  },
  "def-card-faculty-attendance": {
    titleKey: "widget.title.attendanceToday",
    subTextKey: "widget.subtitle.averagePresentRate",
    trendMetric: "attendance",
  },
  "def-card-faculty-hasanat": {
    titleKey: "widget.title.hasanatAwarded",
    subTextKey: "widget.subtitle.awardedByMe",
    trendMetric: "hasanat",
  },
  "def-card-faculty-classes": {
    titleKey: "widget.title.myClasses",
    subTextKey: "widget.subtitle.activeClassesCount",
    trendMetric: "sessions",
  },
  "def-card-faculty-sessions": {
    titleKey: "widget.title.sessionsToday",
    subTextKey: "widget.subtitle.fromActiveSessions",
    trendMetric: "sessions",
  },
  "def-card-accountant-fees": {
    titleKey: "widget.title.feeCollection",
    subTextKey: "widget.subtitle.thisMonth",
    trendMetric: "fees",
  },
  "def-card-accountant-outstanding": {
    titleKey: "widget.title.outstandingPayments",
    subTextKey: "widget.subtitle.unpaidInvoices",
    trendMetric: "outstanding",
  },
  "def-card-accountant-revenue": {
    titleKey: "widget.title.totalRevenueYtd",
    subTextKey: "widget.subtitle.fromInvoices",
    trendMetric: "fees",
  },
  "def-card-accountant-expenses": {
    titleKey: "widget.title.totalExpensesYtd",
    subTextKey: "widget.subtitle.totalDiscountOffset",
    trendMetric: "fees",
  },
  "def-card-accountant-contacts": {
    titleKey: "widget.title.totalContacts",
    subTextKey: "widget.subtitle.totalContacts",
    trendMetric: "contacts",
  },
  "def-contacts-total": { titleKey: "widget.title.totalContacts", trendMetric: "contacts" },
  "def-contacts-whatsapp": { titleKey: "widget.title.whatsappVerifiedRate" },
  "def-students-kpi": { titleKey: "widget.title.activeStudents", trendMetric: "students" },
  "def-students-lock": { titleKey: "widget.title.attendanceLocking" },
  "def-attendance-summary": { titleKey: "widget.title.todaysAttendanceSummary" },
  "def-attendance-rate": { titleKey: "widget.title.attendanceRate", trendMetric: "attendance" },
  "def-enrollment-trends": { titleKey: "widget.title.enrollmentTrends" },
  "def-finance-outstanding": {
    titleKey: "widget.title.overduePayments",
    trendMetric: "outstanding",
  },
  "def-finance-paid-rate": { titleKey: "widget.title.paidInvoicesRatio" },
  "def-finance-toggle-rev": { titleKey: "widget.title.showRevenueGraph" },
  "def-fee-summary": { titleKey: "widget.title.feeCollectionSummary", trendMetric: "fees" },
  "def-outstanding-list": {
    titleKey: "widget.title.outstandingInvoicesList",
    trendMetric: "outstanding",
  },
  "def-overdue-obligations": { titleKey: "widget.title.overdueObligations" },
  "def-revenue-expenses": { titleKey: "widget.title.revenueExpenses" },
  "def-hasanat-points": { titleKey: "widget.title.totalPointsIssued", trendMetric: "hasanat" },
  "def-hasanat-distribution": { titleKey: "widget.title.hasanatDistribution" },
  "def-sessions-count": { titleKey: "widget.title.activeSessions", trendMetric: "sessions" },
  "def-sessions-list": { titleKey: "widget.title.activeSessionsList" },
  "def-sessions-toggle-grid": { titleKey: "widget.title.dashboardSessionList" },
};

/** i18n title keys for seeded widgets (derived from the registry). */
export const DEFAULT_WIDGET_TITLE_KEYS: Partial<Record<string, AppTranslationKey>> =
  Object.fromEntries(
    Object.entries(DASHBOARD_WIDGET_REGISTRY)
      .map(([id, entry]) => (entry.titleKey ? [id, entry.titleKey] : null))
      .filter((entry): entry is [string, AppTranslationKey] => entry !== null),
  );

/** i18n subtitle keys for seeded widgets (derived from the registry). */
export const DEFAULT_WIDGET_SUBTEXT_KEYS: Partial<Record<string, AppTranslationKey>> =
  Object.fromEntries(
    Object.entries(DASHBOARD_WIDGET_REGISTRY)
      .map(([id, entry]) => (entry.subTextKey ? [id, entry.subTextKey] : null))
      .filter((entry): entry is [string, AppTranslationKey] => entry !== null),
  );

export function resolveWidgetTitle(
  widget: WidgetI18nSource,
  t: (key: AppTranslationKey) => string,
): string {
  const key = widget.titleKey ?? DASHBOARD_WIDGET_REGISTRY[widget.id]?.titleKey;
  if (key) return t(key);
  return widget.title;
}

/**
 * Resolve card subtitle: keyed defaults first, then user fixed text. Empty string
 * if neither.
 *
 * A subtitle that repeats the title (three seeded widgets did: “Total Contacts” /
 * “Total contacts”) is suppressed; consumers fall back to a count subtitle, so the
 * card shows useful information instead of a duplicate label (2026-10-31 review).
 */
export function resolveWidgetSubText(
  widget: WidgetI18nSource,
  t: (key: AppTranslationKey) => string,
): string {
  const key = widget.fixedSubTextKey ?? DASHBOARD_WIDGET_REGISTRY[widget.id]?.subTextKey;
  const subText = key ? t(key) : (widget.fixedSubText ?? "");
  const title = resolveWidgetTitle(widget, t);
  return subText.trim().toLowerCase() === title.trim().toLowerCase() ? "" : subText;
}

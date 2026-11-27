export const applyContactsWidgetWorkDrillDown = (...a: any[]): any =>
  libCall("applyContactsWidgetWorkDrillDown", ...a);
export const applyContactsWorkDrillDown = (...a: any[]): any =>
  libCall("applyContactsWorkDrillDown", ...a);
export const applyStudentsWorkDrillDown = (...a: any[]): any =>
  libCall("applyStudentsWorkDrillDown", ...a);
export const applyAttendanceWorkDrillDown = (...a: any[]): any =>
  libCall("applyAttendanceWorkDrillDown", ...a);
export const applyEnrollmentsWorkDrillDown = (...a: any[]): any =>
  libCall("applyEnrollmentsWorkDrillDown", ...a);
export const applyFacultyWorkDrillDown = (...a: any[]): any =>
  libCall("applyFacultyWorkDrillDown", ...a);
export const applyFinanceWorkDrillDown = (...a: any[]): any =>
  libCall("applyFinanceWorkDrillDown", ...a);
export const chartDirection = (...a: any[]): any => libCall("chartDirection", ...a);
export const resolveWidgetTitle = (...a: any[]): any => libCall("resolveWidgetTitle", ...a);
export const resolveWidgetSubText = (...a: any[]): any => libCall("resolveWidgetSubText", ...a);
export function isSeededDashboardWidget(id: any): any {
  return (
    (getAnalyticsHost() as any).reportLibs?.isSeededDashboardWidget?.(id) ??
    String(id ?? "").startsWith("def-card-")
  );
}
export const facultyNameById = (...a: any[]): any => libCall("facultyNameById", ...a);
export function resolveClassFacultyId(c: any): any {
  return (getAnalyticsHost() as any).reportLibs?.resolveClassFacultyId?.(c) ?? c?.facultyId;
}
export function resolveClassFacultyName(c: any): any {
  return (
    (getAnalyticsHost() as any).reportLibs?.resolveClassFacultyName?.(c) ??
    c?.facultyName ??
    "Unassigned"
  );
}
export const facultyStatusBadgeConfig = (...a: any[]): any =>
  libCall("facultyStatusBadgeConfig", ...a);
export const studentStatusBadgeConfig = (...a: any[]): any =>
  libCall("studentStatusBadgeConfig", ...a);
export const enrollmentStatusBadgeConfig = (...a: any[]): any =>
  libCall("enrollmentStatusBadgeConfig", ...a);
export const getCollectionLabel = (...a: any[]): any => libCall("getCollectionLabel", ...a);
export const getFieldLabel = (...a: any[]): any => libCall("getFieldLabel", ...a);
export const computeCustomCard = (...a: any[]): any => libCall("computeCustomCard", ...a);
export const useReportCollectionRows = (...a: any[]): any =>
  libCall("useReportCollectionRows", ...a);
export const useWidgetCollections = (...a: any[]): any => libCall("useWidgetCollections", ...a);
export const computeWidgetChartData = (...a: any[]): any => libCall("computeWidgetChartData", ...a);
export const computeWidgetSingleValue = (...a: any[]): any =>
  libCall("computeWidgetSingleValue", ...a);
export const getFilteredRecords = (...a: any[]): any => libCall("getFilteredRecords", ...a);
export const getWidgetCollections = (...a: any[]): any => libCall("getWidgetCollections", ...a);
export const computeContactsCustomCardValue = (...a: any[]): any =>
  libCall("computeContactsCustomCardValue", ...a);
export const computeEnrollmentsCustomCardValue = (...a: any[]): any =>
  libCall("computeEnrollmentsCustomCardValue", ...a);
export const computeFacultyCustomCardValue = (...a: any[]): any =>
  libCall("computeFacultyCustomCardValue", ...a);
export const computeSessionsCustomCardValue = (...a: any[]): any =>
  libCall("computeSessionsCustomCardValue", ...a);
export const computeStudentsCustomCardValue = (...a: any[]): any =>
  libCall("computeStudentsCustomCardValue", ...a);
export const calculateReportDateRange = (...a: any[]): any =>
  libCall("calculateReportDateRange", ...a);
export const getDefaultCardConfig = (...a: any[]): any => libCall("getDefaultCardConfig", ...a);
export const buildDefaultCustomWidgets = (...a: any[]): any =>
  libCall("buildDefaultCustomWidgets", ...a);

import { getAnalyticsHost } from "../host.js";

function libs(): any {
  return (getAnalyticsHost() as any).reportLibs ?? {};
}

export function libCall(name: string, ...args: any[]): any {
  return libs()[name]?.(...args);
}

export const libValue = (name: string): any => libs()[name];

export const ALERT_COLOR_MAP: Record<string, unknown> = new Proxy(
  {},
  {
    get: (_t: any, k: any) => libs().ALERT_COLOR_MAP?.[k as string],
  },
);
export const COLOR_MAP: Record<string, unknown> = new Proxy(
  {},
  {
    get: (_t: any, k: any) => libs().COLOR_MAP?.[k as string],
  },
);
export const ICONS_LIST: unknown[] = new Proxy([], {
  get: (_t: any, k: any) => libs().ICONS_LIST?.[k as string],
});
export const THEME_PALETTES: Record<string, unknown> = new Proxy(
  {},
  {
    get: (_t: any, k: any) => libs().THEME_PALETTES?.[k as string],
  },
);
export const COLLECTION_OPTIONS: unknown[] = new Proxy([], {
  get: (_t: any, k: any) => libs().COLLECTION_OPTIONS?.[k as string],
});
export const METADATA_FIELDS: unknown[] = new Proxy([], {
  get: (_t: any, k: any) => libs().METADATA_FIELDS?.[k as string],
});
export const MESSAGING_CHANNEL_CONFIG: Record<string, unknown> = new Proxy(
  {},
  {
    get: (_t: any, k: any) => libs().MESSAGING_CHANNEL_CONFIG?.[k as string],
  },
);
export type CustomWidget = any;
export type VisualizerConfig = any;
export type CustomCard = any;
export type ReportCollection = any;
export type ReportCollectionsSnapshot = any;
export type SavedReportsSource = any;
export type MessagingChannelConfig = any;
export const useContactConfig = (...a: any[]): any => libCall("useContactConfig", ...a);
export function getObject<_T = any>(...a: any[]): any {
  return (getAnalyticsHost() as any).reportLibs?.getObject?.(...a) ?? a[1];
}
export function saveObject(...a: any[]): any {
  return (getAnalyticsHost() as any).reportLibs?.saveObject?.(...a);
}

export function getCollection<T = any>(key: string, fallback?: T): any {
  return (getAnalyticsHost() as any).reportLibs?.getCollection?.(key) ?? fallback;
}

export const DEFAULT_WIDGET_TITLE_KEYS: Record<string, any> = new Proxy(
  {},
  {
    get: (_t, k) =>
      (getAnalyticsHost() as any).reportLibs?.DEFAULT_WIDGET_TITLE_KEYS?.[k as string],
  },
);
export const DEFAULT_WIDGET_SUBTEXT_KEYS: Record<string, any> = new Proxy(
  {},
  {
    get: (_t, k) =>
      (getAnalyticsHost() as any).reportLibs?.DEFAULT_WIDGET_SUBTEXT_KEYS?.[k as string],
  },
);

export function readObjectLocal<_T = any>(key: string): any {
  return (getAnalyticsHost() as any).reportLibs?.readObjectLocal?.(key);
}

export function writeObjectLocal<T = any>(key: string, value: T): any {
  return (getAnalyticsHost() as any).reportLibs?.writeObjectLocal?.(key, value);
}

export const findCachedCollectionRecord = (...a: any[]): any =>
  libCall("findCachedCollectionRecord", ...a);

export function readQueryCollection<_T = any>(...a: any[]): any {
  return libCall("readQueryCollection", ...a);
}

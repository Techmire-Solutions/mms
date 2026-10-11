import { CONTACTS_MODULE_MANIFEST } from "@mms/shared";

export const CONTACTS_API = CONTACTS_MODULE_MANIFEST.restBasePath;

export const CONTACTS_QUERY_KEY = [CONTACTS_MODULE_MANIFEST.collectionKey, "list"] as const;
export const CONTACT_COLUMN_PREFERENCES_QUERY_KEY = [
  CONTACTS_MODULE_MANIFEST.collectionKey,
  "column-preferences",
] as const;
export const CONTACTS_SAVED_REPORTS_QUERY_KEY = [
  CONTACTS_MODULE_MANIFEST.collectionKey,
  "saved-reports",
] as const;
export const CONTACTS_GOOGLE_SYNC_QUERY_KEY = [
  CONTACTS_MODULE_MANIFEST.collectionKey,
  "google-sync",
] as const;
export const CONTACTS_METRICS_QUERY_KEY = [
  CONTACTS_MODULE_MANIFEST.collectionKey,
  "metrics",
] as const;
export const CONTACTS_REPORT_ANALYTICS_QUERY_KEY = [
  CONTACTS_MODULE_MANIFEST.collectionKey,
  "report-analytics",
] as const;
export const CONTACTS_WIDGET_AGGREGATES_QUERY_KEY = [
  CONTACTS_MODULE_MANIFEST.collectionKey,
  "widget-aggregates",
] as const;
export const CONTACTS_DUPLICATES_QUERY_KEY = [
  CONTACTS_MODULE_MANIFEST.collectionKey,
  "duplicates",
] as const;

export function contactDetailQueryKey(contactId: string) {
  return [...CONTACTS_QUERY_KEY, "detail", contactId] as const;
}

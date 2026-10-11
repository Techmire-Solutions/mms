import { applyTitleCaseRecursive } from "@mms/shared";
import { dispatchLocalDatabaseUpdate, safeSetItem, scopedStorageKey } from "@/lib/dbStorageCore.js";
import { reportClientError, reportClientWarn } from "@/lib/clientErrorReporting";

const TITLE_CASE_EXCLUDED_KEYWORDS = [
  "settings",
  "config",
  "widgets",
  "preferences",
  "visuals",
  "cards",
  "categories",
  "sourcebooks",
  "template",
  "tabs",
  "placeholders",
  "draft",
  "backup",
];

export function shouldSkipTitleCase(key: string): boolean {
  const lk = key.toLowerCase();
  return TITLE_CASE_EXCLUDED_KEYWORDS.some((kw) => lk.includes(kw));
}

export function getObject<T>(key: string, defaultData: T): T {
  try {
    const saved = localStorage.getItem(scopedStorageKey(key));
    if (saved !== null && saved !== "undefined") {
      try {
        return JSON.parse(saved) as T;
      } catch (error) {
        reportClientWarn(error, { context: "db.parseCachedObject", key });
      }
    }
    safeSetItem(scopedStorageKey(key), JSON.stringify(defaultData));

    return defaultData;
  } catch (error) {
    reportClientError(error, { context: "db.readObject", key });
    return defaultData;
  }
}

export function readObjectLocal<T>(key: string): T | null {
  try {
    const saved = localStorage.getItem(scopedStorageKey(key));
    if (saved !== null && saved !== "undefined") {
      try {
        return JSON.parse(saved) as T;
      } catch (error) {
        reportClientWarn(error, { context: "db.parseCachedObjectLocal", key });
      }
    }
  } catch (error) {
    reportClientError(error, { context: "db.readObjectLocal", key });
  }
  return null;
}

export function writeObjectLocal<T>(key: string, objectValue: T): T {
  const processed = shouldSkipTitleCase(key)
    ? objectValue
    : (applyTitleCaseRecursive(objectValue) as T);
  safeSetItem(scopedStorageKey(key), JSON.stringify(processed));
  dispatchLocalDatabaseUpdate();
  return processed;
}

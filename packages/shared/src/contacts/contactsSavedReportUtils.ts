import type { ContactsSavedReport, ContactsWorkDrillDown } from "./contactsPreferencesTypes.js";
import { isContactsQuickFilter } from "./contactsListQuery.js";

export type ContactsSavedReportShareScope = "private" | "roles" | "users" | "global";

export interface ContactsSavedReportViewer {
  id: string;
  role: string;
  isAdmin?: boolean;
}

interface ContactsSavedReportIssue {
  kind: "stale_gender" | "stale_quick_filter";
  field: keyof ContactsWorkDrillDown;
  value: string;
}

/** Whether the viewer may see a saved report preset (globle1 §4.4). */
export function canViewContactsSavedReport(
  report: ContactsSavedReport,
  viewer: ContactsSavedReportViewer,
): boolean {
  const scope = report.shareScope ?? "private";
  if (scope === "global") return true;
  if (report.createdBy === viewer.id) return true;
  if (viewer.isAdmin) return true;
  if (scope === "private") return false;
  if (scope === "roles") {
    return (report.sharedWithRoles ?? []).includes(viewer.role);
  }
  if (scope === "users") {
    return (report.sharedWithUserIds ?? []).includes(viewer.id);
  }
  return false;
}

/** Whether the viewer may delete a saved report preset. */
export function canDeleteContactsSavedReport(
  report: ContactsSavedReport,
  viewer: ContactsSavedReportViewer,
): boolean {
  return report.createdBy === viewer.id || Boolean(viewer.isAdmin);
}

/** Detects drill-down values that no longer match Setup (globle1 §4.4). */
export function validateContactsSavedReportDrillDown(
  drillDown: ContactsWorkDrillDown,
  options: {
    genders?: string[];
  },
): ContactsSavedReportIssue[] {
  const issues: ContactsSavedReportIssue[] = [];
  if (drillDown.gender && options.genders?.length && !options.genders.includes(drillDown.gender)) {
    issues.push({
      kind: "stale_gender",
      field: "gender",
      value: drillDown.gender,
    });
  }
  if (drillDown.quickFilter && !isContactsQuickFilter(drillDown.quickFilter)) {
    issues.push({
      kind: "stale_quick_filter",
      field: "quickFilter",
      value: drillDown.quickFilter,
    });
  }
  return issues;
}

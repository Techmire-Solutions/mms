import type { LucideIcon } from "lucide-react";
import { Award, BarChart2, Building2, Settings, Users } from "lucide-react";
import { normalizeModuleTierTabId } from "@mms/shared";

/** Faculty peer tabs (Faculty-only exception to Work | Reports | Setup). */
export const FACULTY_PAGE_TAB_IDS = [
  "faculties",
  "departments",
  "designations",
  "reports",
  "setup",
] as const;
export type FacultyPageTabId = (typeof FACULTY_PAGE_TAB_IDS)[number];

/** Entity catalogs that support Add / Import / Export on the Faculty page. */
export const FACULTY_IO_ENTITY_IDS = ["faculties", "departments", "designations"] as const;
export type FacultyIoEntity = (typeof FACULTY_IO_ENTITY_IDS)[number];

export const FACULTY_PAGE_TAB_DEFAULT: FacultyPageTabId = "faculties";

export const FACULTY_PAGE_TAB_KEYS: Record<
  FacultyPageTabId,
  | "faculty.tabs.faculties"
  | "faculty.tabs.departments"
  | "faculty.tabs.designations"
  | "module.reports"
  | "module.setup"
> = {
  faculties: "faculty.tabs.faculties",
  departments: "faculty.tabs.departments",
  designations: "faculty.tabs.designations",
  reports: "module.reports",
  setup: "module.setup",
};

export const FACULTY_PAGE_TAB_HINT_KEYS: Record<
  FacultyPageTabId,
  "module.workHint" | "module.reportsHint" | "module.setupHint"
> = {
  faculties: "module.workHint",
  departments: "module.workHint",
  designations: "module.workHint",
  reports: "module.reportsHint",
  setup: "module.setupHint",
};

export const FACULTY_PAGE_TAB_ICONS: Record<FacultyPageTabId, LucideIcon> = {
  faculties: Users,
  departments: Building2,
  designations: Award,
  reports: BarChart2,
  setup: Settings,
};

export function isFacultyIoEntity(value: string): value is FacultyIoEntity {
  return (FACULTY_IO_ENTITY_IDS as readonly string[]).includes(value);
}

export function isFacultyPageTabId(value: string): value is FacultyPageTabId {
  return (FACULTY_PAGE_TAB_IDS as readonly string[]).includes(value);
}

/** Map persisted/legacy values onto a Faculty peer tab id. */
export function migrateFacultyPageTab(
  rawTab: string,
  legacyWorkSubTab: string = FACULTY_PAGE_TAB_DEFAULT,
): FacultyPageTabId {
  const normalized = normalizeModuleTierTabId(rawTab);
  if (normalized === "work") {
    if (legacyWorkSubTab === "departments") return "departments";
    return isFacultyIoEntity(legacyWorkSubTab) ? legacyWorkSubTab : FACULTY_PAGE_TAB_DEFAULT;
  }
  if (isFacultyPageTabId(normalized)) return normalized;
  return FACULTY_PAGE_TAB_DEFAULT;
}

/** First tab the caller may show: the default tier when visible, else the first visible id. */
function firstVisibleFacultyTab(visibleTabIds: readonly string[]): string {
  if (visibleTabIds.includes(FACULTY_PAGE_TAB_DEFAULT)) return FACULTY_PAGE_TAB_DEFAULT;
  return visibleTabIds[0] ?? "";
}

/**
 * Resolves the persisted tier against the tabs the user may see.
 *
 * A persisted tier that is no longer visible (revoked Reports/Setup permission)
 * must never blank the module body, so it repairs to the first visible tab —
 * both the tab strip and the body read this value.
 */
export function resolveFacultyPageTab(
  value: string,
  visibleTabIds: readonly string[],
  legacyWorkSubTab: string = FACULTY_PAGE_TAB_DEFAULT,
): string {
  const fallback = firstVisibleFacultyTab(visibleTabIds);
  if (value === "") return fallback;
  const migrated = migrateFacultyPageTab(value, legacyWorkSubTab);
  return visibleTabIds.includes(migrated) ? migrated : fallback;
}

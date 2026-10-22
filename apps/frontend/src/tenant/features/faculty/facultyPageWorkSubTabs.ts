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
export const FACULTY_IO_ENTITY_IDS = ["faculties", "designations"] as const;
export type FacultyIoEntity = (typeof FACULTY_IO_ENTITY_IDS)[number];

export const FACULTY_PAGE_TAB_DEFAULT: FacultyPageTabId = "faculties";

/** @deprecated Use FACULTY_IO_ENTITY_IDS — kept for transitional imports. */
export const FACULTY_WORK_SUB_TAB_IDS = FACULTY_IO_ENTITY_IDS;
/** @deprecated Use FacultyIoEntity */
export type FacultyWorkSubTabId = FacultyIoEntity;
/** @deprecated Use FACULTY_PAGE_TAB_DEFAULT */
export const FACULTY_WORK_SUB_TAB_DEFAULT: FacultyIoEntity = "faculties";

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

/** @deprecated Use FACULTY_PAGE_TAB_KEYS */
export const FACULTY_WORK_SUB_TAB_KEYS = {
  faculties: FACULTY_PAGE_TAB_KEYS.faculties,
  designations: FACULTY_PAGE_TAB_KEYS.designations,
} as const;

/** @deprecated Use FACULTY_PAGE_TAB_ICONS */
export const FACULTY_WORK_SUB_TAB_ICONS = {
  faculties: FACULTY_PAGE_TAB_ICONS.faculties,
  designations: FACULTY_PAGE_TAB_ICONS.designations,
} as const;

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

/** @deprecated Use migrateFacultyPageTab / isFacultyIoEntity */
export function resolveFacultyWorkSubTab(value: string): FacultyIoEntity {
  return isFacultyIoEntity(value) ? value : FACULTY_WORK_SUB_TAB_DEFAULT;
}

export function resolveFacultyPageTab(
  value: string,
  visibleTabIds: readonly string[],
  legacyWorkSubTab: string = FACULTY_PAGE_TAB_DEFAULT,
): string {
  if (value === "") return "";
  const migrated = migrateFacultyPageTab(value, legacyWorkSubTab);
  return visibleTabIds.includes(migrated) ? migrated : "";
}

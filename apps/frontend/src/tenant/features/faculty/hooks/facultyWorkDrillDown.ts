import { createModuleWorkDrillDown } from "@/lib/query/createModuleWorkDrillDown";
import type { FacultyQuickFilter } from "@mms/shared";

export const FACULTY_WORK_DRILLDOWN_EVENT = "faculty-work-drilldown";

export interface FacultyWorkDrillDown {
  /** Work quick-filter preset (e.g. active, onLeave). */
  quickFilter?: FacultyQuickFilter;
  department?: string;
  designation?: string;
  reportingFacultyId?: string;
}

const { apply, consume } = createModuleWorkDrillDown<FacultyWorkDrillDown>({
  event: FACULTY_WORK_DRILLDOWN_EVENT,
  storageKey: "mms_faculty_work_drilldown",
});

export function applyFacultyWorkDrillDown(filter: FacultyWorkDrillDown): void {
  apply(filter);
}

export function consumeFacultyWorkDrillDown(): FacultyWorkDrillDown | null {
  return consume();
}

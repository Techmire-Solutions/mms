import { createModuleWorkDrillDown } from "@mms/fe-core/lib/createModuleWorkDrillDown";

export const STUDENTS_WORK_DRILLDOWN_EVENT = "students-work-drilldown";

export interface StudentsWorkDrillDown {
  /** Work status filter preset (e.g. active, inactive). */
  status?: string;
}

const { apply, consume } = createModuleWorkDrillDown<StudentsWorkDrillDown>({
  event: STUDENTS_WORK_DRILLDOWN_EVENT,
  storageKey: "mms_students_work_drilldown",
});

export function applyStudentsWorkDrillDown(filter: StudentsWorkDrillDown): void {
  apply(filter);
}

export function consumeStudentsWorkDrillDown(): StudentsWorkDrillDown | null {
  return consume();
}

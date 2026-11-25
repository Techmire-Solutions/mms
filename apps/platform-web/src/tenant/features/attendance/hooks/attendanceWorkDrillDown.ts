import { createModuleWorkDrillDown } from "@mms/fe-core/lib/createModuleWorkDrillDown";

export const ATTENDANCE_WORK_DRILLDOWN_EVENT = "attendance-work-drilldown";

export interface AttendanceWorkDrillDown {
  /** Opens Work → Records filtered to this ISO day. */
  date?: string;
}

const { apply, consume } = createModuleWorkDrillDown<AttendanceWorkDrillDown>({
  event: ATTENDANCE_WORK_DRILLDOWN_EVENT,
  storageKey: "mms_attendance_work_drilldown",
});

export const applyAttendanceWorkDrillDown = apply;
export const consumeAttendanceWorkDrillDown = consume;

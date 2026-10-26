import { createModuleWorkDrillDown } from "@/lib/query/createModuleWorkDrillDown";

export const ENROLLMENTS_WORK_DRILLDOWN_EVENT = "enrollments-work-drilldown";

export interface EnrollmentsWorkDrillDown {
  /** Work sub-tab to open (e.g. "admissions" from a waitlist seat notification). */
  subTab: "directory" | "admissions";
}

const { apply, consume } = createModuleWorkDrillDown<EnrollmentsWorkDrillDown>({
  event: ENROLLMENTS_WORK_DRILLDOWN_EVENT,
  storageKey: "mms_enrollments_work_drilldown",
});

export const applyEnrollmentsWorkDrillDown = apply;
export const consumeEnrollmentsWorkDrillDown = consume;

import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { isFacultyQuickFilter, type FacultyQuickFilter } from "@mms/shared";
import {
  FACULTY_WORK_DRILLDOWN_EVENT,
  consumeFacultyWorkDrillDown,
  type FacultyWorkDrillDown,
} from "@/tenant/features/faculty/hooks/facultyWorkDrillDown";

/** Applies Work drill-down events onto directory filter setters. */
export function useFacultyDirectoryDrillDown({
  setActiveTab,
  setQuickFilter,
  setFilterStatus,
  setFilterDepartment,
  setFilterDesignation,
  setFilterReportingFacultyId,
}: {
  setActiveTab: (tab: string) => void;
  setQuickFilter: Dispatch<SetStateAction<FacultyQuickFilter>>;
  setFilterStatus: Dispatch<SetStateAction<string[]>>;
  setFilterDepartment: Dispatch<SetStateAction<string>>;
  setFilterDesignation: Dispatch<SetStateAction<string>>;
  setFilterReportingFacultyId: Dispatch<SetStateAction<string>>;
}) {
  const applyDrillDown = useCallback(
    (filter: FacultyWorkDrillDown) => {
      setQuickFilter("all");
      setFilterStatus([]);
      if (filter.quickFilter && isFacultyQuickFilter(filter.quickFilter)) {
        setQuickFilter(filter.quickFilter);
      }
      if (filter.department) setFilterDepartment(filter.department);
      if (filter.designation) setFilterDesignation(filter.designation);
      if (filter.reportingFacultyId) setFilterReportingFacultyId(filter.reportingFacultyId);
      setActiveTab("faculties");
    },
    [
      setActiveTab,
      setFilterDepartment,
      setFilterDesignation,
      setFilterReportingFacultyId,
      setFilterStatus,
      setQuickFilter,
    ],
  );

  useEffect(() => {
    const pending = consumeFacultyWorkDrillDown();
    if (pending) applyDrillDown(pending);

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<FacultyWorkDrillDown>).detail;
      if (detail) applyDrillDown(detail);
    };
    window.addEventListener(FACULTY_WORK_DRILLDOWN_EVENT, handler);
    return () => window.removeEventListener(FACULTY_WORK_DRILLDOWN_EVENT, handler);
  }, [applyDrillDown]);
}

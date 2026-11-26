import { getAttendanceHost } from "../host.js";

export function academicCalendarQueries(...args: any[]): any {
  const v = (getAttendanceHost() as any).academicCalendarQueries?.["academicCalendarQueries"];
  return typeof v === "function" ? v(...args) : v;
}

export function academicCalendarQueryOptions(...args: any[]): any {
  const v = (getAttendanceHost() as any).academicCalendarQueries?.["academicCalendarQueryOptions"];
  return typeof v === "function" ? v(...args) : v;
}

export function deleteAcademicCalendarEventMutationOptions(...args: any[]): any {
  const v = (getAttendanceHost() as any).academicCalendarQueries?.[
    "deleteAcademicCalendarEventMutationOptions"
  ];
  return typeof v === "function" ? v(...args) : v;
}

export function invalidateAcademicCalendarQueries(...args: any[]): any {
  const v = (getAttendanceHost() as any).academicCalendarQueries?.[
    "invalidateAcademicCalendarQueries"
  ];
  return typeof v === "function" ? v(...args) : v;
}

export function restoreAcademicCalendarEventMutationOptions(...args: any[]): any {
  const v = (getAttendanceHost() as any).academicCalendarQueries?.[
    "restoreAcademicCalendarEventMutationOptions"
  ];
  return typeof v === "function" ? v(...args) : v;
}

export function saveAcademicCalendarEventMutationOptions(...args: any[]): any {
  const v = (getAttendanceHost() as any).academicCalendarQueries?.[
    "saveAcademicCalendarEventMutationOptions"
  ];
  return typeof v === "function" ? v(...args) : v;
}

export type AcademicCalendarRangeQuery = any;

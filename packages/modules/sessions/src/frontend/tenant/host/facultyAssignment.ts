import { getSessionsHost } from "../host.js";

function hostFn(name: string) {
  return (...args: any[]) => (getSessionsHost() as any).facultyAssignment?.[name]?.(...args);
}

export const facultyNameById: any = hostFn("facultyNameById");
export const resolveClassFacultyId: any = hostFn("resolveClassFacultyId");
export const resolveClassFacultyName: any = hostFn("resolveClassFacultyName");

export const assignClassFaculty: any = hostFn("assignClassFaculty");

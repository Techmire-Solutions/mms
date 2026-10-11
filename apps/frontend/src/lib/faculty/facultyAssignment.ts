import type { Session, FacultyMember } from "@mms/shared";
import { DEFAULT_FACULTY_STATUS } from "@mms/shared";

export interface FacultyAssignedClassItem {
  sessionId: string;
  sessionName: string;
  sessionType?: string;
  sessionStatus?: string;
  classId: string;
  className: string;
  room?: string;
  capacity?: number;
  enrolled?: number;
  gender?: string;
  ageMin?: number;
  ageMax?: number;
}

/** Resolves a faculty display name from the faculty registry. */
export function facultyNameById(
  faculty: FacultyMember[] | Map<string, FacultyMember>,
  id: string,
): string {
  if (!id) return "";
  if (faculty instanceof Map) return faculty.get(id)?.name ?? "";
  return faculty.find((member) => String(member.id) === id)?.name ?? "";
}

/** Persists only `facultyId` — display name is hydrated from registry. */
export function assignClassFaculty(facultyId: string): { facultyId: string } {
  const id = facultyId || "";
  return { facultyId: id };
}

export function resolveClassFacultyId(
  sessionClass: { facultyId?: string | null } | null | undefined,
): string {
  if (!sessionClass) return "";
  return String(sessionClass.facultyId || "");
}

export function resolveClassFacultyName(
  sessionClass: { facultyName?: string | null } | null | undefined,
): string {
  if (!sessionClass) return "";
  return sessionClass.facultyName || "";
}

/** Active faculty eligible for new class assignments. */
export function activeFacultyForAssignment(faculty: FacultyMember[]): FacultyMember[] {
  const targetStatus = DEFAULT_FACULTY_STATUS;
  return faculty.filter((member) => member.status === targetStatus);
}

/** Options for class faculty select — active faculty plus the current assignee if inactive. */
export function facultyOptionsForClass(
  faculty: FacultyMember[],
  currentFacultyId?: string,
): FacultyMember[] {
  const active = activeFacultyForAssignment(faculty);
  if (!currentFacultyId || active.some((member) => String(member.id) === currentFacultyId)) {
    return active;
  }
  const current = faculty.find((member) => String(member.id) === currentFacultyId);
  return current ? [current, ...active] : active;
}

/** Extracts all classes assigned to a specific faculty member from the sessions array. */
export function getFacultyAssignedClasses(
  facultyId: string | number,
  sessions: Session[],
): FacultyAssignedClassItem[] {
  const list: FacultyAssignedClassItem[] = [];
  const facultyIdStr = String(facultyId);
  for (const session of sessions) {
    if (!session.classes || session.classes.length === 0) continue;
    for (const cls of session.classes) {
      if (resolveClassFacultyId(cls) === facultyIdStr) {
        list.push({
          sessionId: session.id,
          sessionName: session.name,
          sessionType: session.type,
          sessionStatus: session.status,
          classId: cls.id,
          className: cls.name,
          room: cls.room,
          capacity:
            (cls as { maxStudents?: number; capacity?: number }).maxStudents ??
            (cls as { maxStudents?: number; capacity?: number }).capacity ??
            30,
          enrolled: cls.enrolled ?? 0,
          gender: cls.gender,
          ageMin:
            (cls as { minAge?: number; ageMin?: number }).minAge ??
            (cls as { minAge?: number; ageMin?: number }).ageMin ??
            5,
          ageMax:
            (cls as { maxAge?: number; ageMax?: number }).maxAge ??
            (cls as { maxAge?: number; ageMax?: number }).ageMax ??
            18,
        });
      }
    }
  }
  return list;
}

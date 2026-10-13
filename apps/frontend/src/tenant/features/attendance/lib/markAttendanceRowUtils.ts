import type { ModuleCustomField } from "@mms/shared";
import type { AttendanceRecord, ClassStudent } from "@/lib/data/attendanceData";
import type { Enrollment } from "@/lib/data/enrollmentData";
import type { Session } from "@/lib/data/sessionsData";
import type { Student } from "@/lib/data/studentsData";
import type {
  AttendanceRow,
  GeoData,
  OfflinePayload,
} from "@/tenant/features/attendance/lib/markAttendanceTypes";

export function buildDefaultRows(
  students: ClassStudent[],
  customFields: ModuleCustomField[] = [],
): AttendanceRow[] {
  return students.map((student) => {
    const row: AttendanceRow = {
      studentId: student.id,
      name: student.name,
      rollNo: student.rollNo,
      status: "present",
      timeIn: "07:00",
      timeOut: "08:30",
      notes: "",
    };
    customFields.forEach((customField) => {
      row[customField.id] = customField.defaultValue ?? "";
    });
    return row;
  });
}

export function attendanceRowsFromRecords(records: AttendanceRecord[]): AttendanceRow[] {
  return records.map((attendanceRecord) => ({
    studentId: attendanceRecord.studentId || "",
    name: attendanceRecord.studentName || "",
    rollNo: attendanceRecord.rollNo ?? "",
    status: attendanceRecord.status,
    timeIn: attendanceRecord.timeIn || "07:00",
    timeOut: attendanceRecord.timeOut || "08:30",
    notes: attendanceRecord.notes || "",
    ...(attendanceRecord.customFields || {}),
  }));
}

export function attendanceRecordsFromRows(
  rows: AttendanceRow[],
  customFields: ModuleCustomField[],
  classId: string,
  date: string,
): AttendanceRecord[] {
  return rows.map((row): AttendanceRecord => {
    const customFieldValues: Record<string, unknown> = {};
    customFields.forEach((customField) => {
      customFieldValues[customField.id] = row[customField.id];
    });

    return {
      id: `${classId}-${date}-${row.studentId}`,
      classId,
      date,
      studentId: row.studentId,
      studentName: row.name,
      rollNo: row.rollNo,
      status: row.status,
      timeIn: row.status !== "absent" ? row.timeIn : "",
      timeOut: row.status !== "absent" ? row.timeOut : "",
      notes: row.notes || "",
      customFields: customFieldValues,
    };
  });
}

export function buildOfflinePayload(
  classId: string,
  date: string,
  rows: AttendanceRow[],
  geo: GeoData | null,
  submittedBy: string,
): OfflinePayload {
  return {
    classId,
    date,
    rows,
    geo,
    submittedBy,
    ts: new Date().toISOString(),
  };
}

export function studentRollNo(student: Student | undefined, studentId: string): string {
  const grNumber = typeof student?.grNumber === "string" ? student.grNumber.trim() : "";
  if (grNumber) return grNumber;
  const numeric = studentId.replace(/\D/g, "");
  return numeric ? `STU-${numeric.padStart(3, "0")}` : studentId;
}

export function isEnrollmentInAttendanceRoster(enrollment: Enrollment, classId: string): boolean {
  return enrollment.classId === classId && enrollment.status !== "cancelled";
}

export function enrolledStudentsForClass(
  classId: string,
  enrollments: Enrollment[],
  students: Student[],
  unnamedStudentLabel: string,
): ClassStudent[] {
  if (!classId) return [];

  const studentsById = new Map(students.map((student) => [String(student.id), student]));
  const seen = new Set<string>();

  return enrollments
    .filter((enrollment) => isEnrollmentInAttendanceRoster(enrollment, classId))
    .flatMap((enrollment) => {
      const studentId = String(enrollment.studentId || "");
      if (!studentId || seen.has(studentId)) return [];
      seen.add(studentId);

      const student = studentsById.get(studentId);
      const name = student?.name || enrollment.studentName || unnamedStudentLabel;
      const gender =
        student?.gender === "female" || student?.gender === "male" ? student.gender : "male";

      return [
        {
          id: studentId,
          name,
          gender,
          rollNo: studentRollNo(student, studentId),
        },
      ];
    });
}

export function resolveSessionAndClassInfo(sessions: readonly Session[], classId?: string) {
  if (!classId) return { classInfo: undefined, sessionInfo: null };
  for (const session of sessions) {
    if (session.classes) {
      for (const sessionClass of session.classes) {
        if (sessionClass.id === classId) {
          return {
            classInfo: { ...sessionClass, sessionId: session.id, sessionName: session.name },
            sessionInfo: session,
          };
        }
      }
    }
  }
  return { classInfo: undefined, sessionInfo: null };
}

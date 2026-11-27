import { useMemo } from "react";
import type { Exam } from "@mms/contracts";
import type { Student } from "@mms/contracts";
import { useSessionsCollection } from "../host/useSessions";
import { useEnrollmentsCollection } from "../host/useEnrollments";
import { useStudentsByIds } from "../host/useStudentsByIds";
import { enrollmentHoldsSeat } from "@mms/contracts";

/**
 * The exam roster is the **seat-holding** enrollment set — the same rule the backend eligibility
 * query uses. The grid previously listed every live enrollment, so a withdrawn student could be
 * typed into the sheet while being absent from the eligibility rows.
 */
function isRosterEnrollment(enrollment: {
  status?: string | null;
  deletedAt?: string | null;
}): boolean {
  if (enrollment.deletedAt) return false;
  return enrollmentHoldsSeat(String(enrollment.status ?? ""));
}

export type ExamStudent = Student & { classId: string; sectionId: string; rollNo: string };

export function useEnterMarksStudents(exam?: Exam) {
  const sessions = useSessionsCollection();
  const enrollments = useEnrollmentsCollection();

  // Single hoisted derivation: every memo below keys off the same reference, so the compiler
  // can preserve the manual memoization (previously each memo read `exam.classIds` through
  // `exam`, a less specific inferred dependency than the listed `exam?.classIds`).
  const classIds = exam?.classIds;

  const classNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const session of sessions) {
      if (session.classes) {
        for (const sessionClass of session.classes) {
          map.set(sessionClass.id, `${session.name} - ${sessionClass.name}`);
        }
      }
    }
    return map;
  }, [sessions]);

  const studentIds = useMemo(() => {
    if (!classIds || classIds.length === 0) return [];
    const examClassIds = new Set(classIds);
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const enrollment of enrollments) {
      if (examClassIds.has(enrollment.classId) && isRosterEnrollment(enrollment)) {
        const idStr = String(enrollment.studentId);
        if (!seen.has(idStr)) {
          seen.add(idStr);
          ids.push(idStr);
        }
      }
    }
    return ids;
  }, [enrollments, classIds]);

  const { data: resolvedStudents = [] } = useStudentsByIds(studentIds);

  const students = useMemo((): ExamStudent[] => {
    if (!classIds || classIds.length === 0) return [];
    const examClassIds = new Set(classIds);
    const enrollmentByStudent = new Map<string, (typeof enrollments)[number]>();
    for (const enrollment of enrollments) {
      if (examClassIds.has(enrollment.classId) && isRosterEnrollment(enrollment)) {
        enrollmentByStudent.set(String(enrollment.studentId), enrollment);
      }
    }
    const result: ExamStudent[] = [];
    for (const student of resolvedStudents) {
      const enrollment = enrollmentByStudent.get(String(student.id));
      if (enrollment) {
        result.push({
          ...student,
          classId: enrollment.classId,
          sectionId: enrollment.sectionId ?? "",
          rollNo: enrollment.rollNo || student.grNumber || "",
        });
      }
    }
    return result;
  }, [enrollments, classIds, resolvedStudents]);

  const sections = useMemo(() => {
    const examClassIds = new Set(classIds ?? []);
    return sessions.flatMap((session: any) =>
      (session.classes ?? [])
        .filter((sessionClass: any) => examClassIds.has(sessionClass.id))
        .flatMap((sessionClass: any) =>
          (sessionClass.sections ?? []).map((section: any) => ({
            ...section,
            name: examClassIds.size > 1 ? `${sessionClass.name} – ${section.name}` : section.name,
          })),
        ),
    );
  }, [sessions, classIds]);

  return {
    classNamesById,
    students,
    sections,
  };
}

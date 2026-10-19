import { useMemo } from "react";
import type { Exam } from "@/lib/data/examinationData";
import type { Student } from "@/lib/data/studentsData";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useEnrollmentsCollection } from "@/tenant/hooks/collections/enrollments";
import { useStudentsByIds } from "@/tenant/hooks/collections/students";

export type ExamStudent = Student & { classId: string; sectionId: string; rollNo: string };

export function useEnterMarksStudents(exam?: Exam) {
  const sessions = useSessionsCollection();
  const enrollments = useEnrollmentsCollection();

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
    if (!exam?.classIds || exam.classIds.length === 0) return [];
    const classIds = new Set(exam.classIds);
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const enrollment of enrollments) {
      if (classIds.has(enrollment.classId)) {
        const idStr = String(enrollment.studentId);
        if (!seen.has(idStr)) {
          seen.add(idStr);
          ids.push(idStr);
        }
      }
    }
    return ids;
  }, [enrollments, exam?.classIds]);

  const { data: resolvedStudents = [] } = useStudentsByIds(studentIds);

  const students = useMemo((): ExamStudent[] => {
    if (!exam?.classIds || exam.classIds.length === 0) return [];
    const classIds = new Set(exam.classIds);
    const enrollmentByStudent = new Map<string, (typeof enrollments)[number]>();
    for (const enrollment of enrollments) {
      if (classIds.has(enrollment.classId)) {
        enrollmentByStudent.set(String(enrollment.studentId), enrollment);
      }
    }
    const result: ExamStudent[] = [];
    for (const student of resolvedStudents as Student[]) {
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
  }, [enrollments, exam?.classIds, resolvedStudents]);

  const sections = useMemo(() => {
    const classIds = new Set(exam?.classIds ?? []);
    return sessions.flatMap((session) =>
      (session.classes ?? [])
        .filter((sessionClass) => classIds.has(sessionClass.id))
        .flatMap((sessionClass) =>
          (sessionClass.sections ?? []).map((section) => ({
            ...section,
            name: classIds.size > 1 ? `${sessionClass.name} – ${section.name}` : section.name,
          })),
        ),
    );
  }, [sessions, exam?.classIds]);

  return {
    classNamesById,
    students,
    sections,
  };
}

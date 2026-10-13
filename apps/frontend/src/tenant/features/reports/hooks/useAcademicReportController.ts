import { useState } from "react";
import { getGrade } from "@mms/shared";
import {
  useExaminationsExams,
  useExaminationsExamsCollection,
  useExaminationsResults,
  useExaminationsResultsCollection,
  useExaminationsReportAggregates,
} from "@/tenant/hooks/collections/examinations";
import { useStudentsByIds } from "@/tenant/hooks/collections/students";
import { uniqueRegistryIds } from "@/lib/registryResolve";
import { useTranslation } from "@/hooks/useTranslation";

import type {
  AcademicReportProps,
  AcademicResultItem,
  ClassRankingItem,
} from "@/components/reports/academicReportTypes";

export function useAcademicReportController({ filters }: AcademicReportProps) {
  const { t } = useTranslation();
  const examsQuery = useExaminationsExams();
  const resultsQuery = useExaminationsResults();
  const aggregatesQuery = useExaminationsReportAggregates();

  const exams = useExaminationsExamsCollection();
  const examResults = useExaminationsResultsCollection();

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const studentIds = (() =>
    uniqueRegistryIds(examResults.map((examResult) => examResult.studentId)))();
  const { data: students = [] } = useStudentsByIds(studentIds);

  const academicResultsData = (() => {
    let academicResults: AcademicResultItem[] = [];
    const examsById = new Map(exams.map((exam) => [exam.id, exam]));
    const studentsById = new Map(
      students.map((student: { id?: string | number; name?: string }) => [
        String(student.id),
        student,
      ]),
    );

    examResults.forEach((examResult) => {
      const exam = examsById.get(examResult.examId);
      const student = studentsById.get(String(examResult.studentId));
      if (!exam || !student) return;

      const percentage = Math.round((examResult.marksObtained / exam.totalMarks) * 100);
      academicResults.push({
        studentName: student.name || "",
        class: exam.name,
        subject: exam.subject,
        marks: percentage,
        total: 100,
        grade: getGrade(percentage).label,
        rank: 0,
      });
    });

    academicResults.sort((firstResult, secondResult) => secondResult.marks - firstResult.marks);
    academicResults.forEach((academicResult, index) => {
      academicResult.rank = index + 1;
    });

    if (filters.class !== "all") {
      academicResults = academicResults.filter(
        (academicResult) => academicResult.class === filters.class,
      );
    }
    if (filters.student) {
      academicResults = academicResults.filter((academicResult) =>
        academicResult.studentName.toLowerCase().includes(filters.student.toLowerCase()),
      );
    }
    return academicResults;
  })() as AcademicResultItem[];

  const classRankings = (() => {
    const resultsByClass: Record<string, { class: string; studentName: string; marks: number }[]> =
      {};
    const examsById = new Map(exams.map((exam) => [exam.id, exam]));
    const studentsById = new Map(
      students.map((student: { id?: string | number; name?: string }) => [
        String(student.id),
        student,
      ]),
    );
    const rankingSourceResults = examResults
      .map((examResult) => {
        const exam = examsById.get(examResult.examId);
        const student = studentsById.get(String(examResult.studentId));
        if (!exam || !student) return null;
        return {
          class: exam.name,
          studentName: student.name || "",
          marks: Math.round((examResult.marksObtained / exam.totalMarks) * 100),
        };
      })
      .filter(Boolean) as { class: string; studentName: string; marks: number }[];

    rankingSourceResults.forEach((rankingSourceResult) => {
      if (!resultsByClass[rankingSourceResult.class])
        resultsByClass[rankingSourceResult.class] = [];
      resultsByClass[rankingSourceResult.class].push(rankingSourceResult);
    });

    let classRankingItems = Object.entries(resultsByClass).map(([className, classResults]) => {
      const sortedClassResults = [...classResults].sort(
        (firstResult, secondResult) => secondResult.marks - firstResult.marks,
      );
      const averageMarks = Math.round(
        classResults.reduce((sum, classResult) => sum + classResult.marks, 0) / classResults.length,
      );
      const passingCount = classResults.filter((classResult) => classResult.marks >= 50).length;
      return {
        class: className,
        averageMarks,
        topMarks: sortedClassResults[0]?.marks || 0,
        passRate: Math.round((passingCount / classResults.length) * 100),
        topStudent: sortedClassResults[0]?.studentName || "—",
      };
    });

    if (filters.class !== "all") {
      classRankingItems = classRankingItems.filter(
        (classRankingItem) => classRankingItem.class === filters.class,
      );
    }
    return classRankingItems;
  })() as ClassRankingItem[];

  const filteredAcademicResultsData = (() => {
    let filteredAcademicResults = academicResultsData;
    if (selectedClass) {
      filteredAcademicResults = filteredAcademicResults.filter(
        (academicResult) => academicResult.class === selectedClass,
      );
    }
    if (selectedStudent) {
      filteredAcademicResults = filteredAcademicResults.filter(
        (academicResult) => academicResult.studentName === selectedStudent,
      );
    }
    return filteredAcademicResults;
  })();

  const filteredClassRankings = (() =>
    selectedClass
      ? classRankings.filter((classRanking) => classRanking.class === selectedClass)
      : classRankings)();

  const toggleClassFilter = (className: string): void => {
    setSelectedClass((currentClass) => (currentClass === className ? null : className));
  };

  const toggleStudentFilter = (studentName: string): void => {
    setSelectedStudent((currentStudent) => (currentStudent === studentName ? null : studentName));
  };

  return {
    t,
    examsQuery,
    resultsQuery,
    aggregatesQuery,
    selectedStudent,
    selectedClass,
    setSelectedStudent,
    setSelectedClass,
    filteredAcademicResultsData,
    filteredClassRankings,
    toggleClassFilter,
    toggleStudentFilter,
  };
}

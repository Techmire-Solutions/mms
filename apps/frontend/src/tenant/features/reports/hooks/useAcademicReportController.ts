import { useState } from "react";
import { rankResults, resolveResultScore } from "@mms/shared";
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

  /**
   * One row per (student, exam), scored by the shared engine: grade/pass from raw marks against the
   * exam's own pass mark (the previous code hardcoded 50), and rank computed per exam — not across
   * unrelated exams, where a 90% quiz used to outrank an 89% final.
   */
  const academicResultsData = (() => {
    const examsById = new Map(exams.map((exam) => [exam.id, exam]));
    const studentsById = new Map(
      students.map((student: { id?: string | number; name?: string }) => [
        String(student.id),
        student,
      ]),
    );

    const scored = examResults.flatMap((examResult) => {
      const exam = examsById.get(examResult.examId);
      const student = studentsById.get(String(examResult.studentId));
      if (!exam || !student) return [];
      const score = resolveResultScore({
        marksObtained: examResult.marksObtained,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        graceMarks: examResult.graceMarks,
      });
      return [
        {
          examId: exam.id,
          studentId: String(examResult.studentId),
          studentName: student.name || "",
          class: exam.name,
          subject: exam.subject,
          displayPct: score.displayPercentage,
          rawPct: score.percentage,
          grade: score.grade.label,
          passed: score.passed,
        },
      ];
    });

    const rankedByExam = new Map<string, Array<(typeof scored)[number] & { rank: number }>>();
    for (const row of scored) {
      const bucket = rankedByExam.get(row.examId) ?? [];
      bucket.push({ ...row, rank: 0 });
      rankedByExam.set(row.examId, bucket);
    }

    const rankedRows: Array<(typeof scored)[number] & { rank: number }> = [];
    for (const bucket of rankedByExam.values()) {
      const ranked = rankResults(bucket, {
        score: (row) => row.rawPct,
        tieBreak: (row) => `${row.studentName}|${row.studentId}`,
      });
      rankedRows.push(...ranked);
    }

    let academicResults: AcademicResultItem[] = rankedRows.map((row) => ({
      studentName: row.studentName,
      class: row.class,
      subject: row.subject,
      marks: row.displayPct,
      total: 100,
      grade: row.grade,
      rank: row.rank,
    }));

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
    const examsById = new Map(exams.map((exam) => [exam.id, exam]));
    const studentsById = new Map(
      students.map((student: { id?: string | number; name?: string }) => [
        String(student.id),
        student,
      ]),
    );

    const resultsByClass: Record<
      string,
      { class: string; studentName: string; marks: number; passed: boolean }[]
    > = {};

    examResults.forEach((examResult) => {
      const exam = examsById.get(examResult.examId);
      const student = studentsById.get(String(examResult.studentId));
      if (!exam || !student) return;
      const score = resolveResultScore({
        marksObtained: examResult.marksObtained,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        graceMarks: examResult.graceMarks,
      });
      const className = exam.name;
      if (!resultsByClass[className]) resultsByClass[className] = [];
      resultsByClass[className].push({
        class: className,
        studentName: student.name || "",
        marks: score.displayPercentage,
        passed: score.passed,
      });
    });

    let classRankingItems = Object.entries(resultsByClass).map(([className, classResults]) => {
      const sortedClassResults = [...classResults].sort(
        (firstResult, secondResult) => secondResult.marks - firstResult.marks,
      );
      const averageMarks = Math.round(
        classResults.reduce((sum, classResult) => sum + classResult.marks, 0) / classResults.length,
      );
      const passingCount = classResults.filter((classResult) => classResult.passed).length;
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

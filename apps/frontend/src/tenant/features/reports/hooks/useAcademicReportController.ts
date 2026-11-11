import { useState } from "react";
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
import {
  rankAcademicRows,
  scoreAcademicRows,
  summarizeClassRankings,
  toAcademicResultItems,
} from "@/tenant/features/reports/lib/academicReportRanking";

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

  // One row per (student, exam) scored by the shared engine; ranking and the class leaderboard use
  // the unrounded raw percentage (ranked/averaged rounded values created artificial ties).
  const scoredRows = scoreAcademicRows(exams, examResults, students);
  const rankedRows = rankAcademicRows(scoredRows);

  let academicResults = toAcademicResultItems(rankedRows);
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
  const academicResultsData = academicResults as AcademicResultItem[];

  let classRankingItems = summarizeClassRankings(scoredRows);
  if (filters.class !== "all") {
    classRankingItems = classRankingItems.filter(
      (classRankingItem) => classRankingItem.class === filters.class,
    );
  }
  const classRankings = classRankingItems as ClassRankingItem[];

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

import { useMemo, useState } from "react";
import {
  useExaminationsExams,
  useExaminationsExamsCollection,
  useExaminationsResults,
  useExaminationsResultsCollection,
  useExaminationsReportAggregates,
} from "../../host/collections";
import { useStudentsByIds } from "../../host/collections";
import { uniqueRegistryIds } from "@mms/fe-core/lib/registryResolve";
import { useTranslation } from "@mms/fe-core/i18n";
import {
  rankAcademicRows,
  scoreAcademicRows,
  summarizeClassRankings,
  toAcademicResultItems,
} from "../lib/academicReportRanking";

import type {
  AcademicReportProps,
  AcademicResultItem,
  ClassRankingItem,
} from "../../components/academicReportTypes";

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
    uniqueRegistryIds(examResults.map((examResult: any) => examResult.studentId)))();
  const { data: students = [] } = useStudentsByIds(studentIds);

  // One row per (student, exam) scored by the shared engine; ranking and the class leaderboard use
  // the unrounded raw percentage (ranked/averaged rounded values created artificial ties).
  // Scoring + ranking runs once per data snapshot — filter/selection toggles only re-filter.
  const scoredRows = useMemo(
    () => scoreAcademicRows(exams, examResults, students),
    [exams, examResults, students],
  );
  const rankedRows = useMemo(() => rankAcademicRows(scoredRows), [scoredRows]);

  let academicResults = toAcademicResultItems(rankedRows);
  if (filters.class !== "all") {
    academicResults = academicResults.filter(
      (academicResult: any) => academicResult.class === filters.class,
    );
  }
  if (filters.student) {
    academicResults = academicResults.filter((academicResult: any) =>
      academicResult.studentName.toLowerCase().includes(filters.student.toLowerCase()),
    );
  }
  const academicResultsData = academicResults as AcademicResultItem[];

  const classRankings = useMemo(() => summarizeClassRankings(scoredRows), [scoredRows]);
  let classRankingItems = classRankings;
  if (filters.class !== "all") {
    classRankingItems = classRankingItems.filter(
      (classRankingItem: any) => classRankingItem.class === filters.class,
    );
  }
  const classRankingItemsData = classRankingItems as ClassRankingItem[];

  const filteredAcademicResultsData = (() => {
    let filteredAcademicResults = academicResultsData;
    if (selectedClass) {
      filteredAcademicResults = filteredAcademicResults.filter(
        (academicResult: any) => academicResult.class === selectedClass,
      );
    }
    if (selectedStudent) {
      filteredAcademicResults = filteredAcademicResults.filter(
        (academicResult: any) => academicResult.studentName === selectedStudent,
      );
    }
    return filteredAcademicResults;
  })();

  const filteredClassRankings = (() =>
    selectedClass
      ? classRankingItemsData.filter((classRanking: any) => classRanking.class === selectedClass)
      : classRankingItemsData)();

  const toggleClassFilter = (className: string): void => {
    setSelectedClass((currentClass: any) => (currentClass === className ? null : className));
  };

  const toggleStudentFilter = (studentName: string): void => {
    setSelectedStudent((currentStudent: any) =>
      currentStudent === studentName ? null : studentName,
    );
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

import type { Exam, ExamResult } from "@/lib/data/examinationData";
import type { ModuleColumnCustomizerProps } from "@/components/app/ModuleColumnCustomizer";
import type { StudentResultItem } from "@/tenant/features/examinations/components/StudentResultCard";

export interface ResultsViewProps {
  exams: Exam[];
  results: ExamResult[];
  /**
   * True when the client-side marks walk hit its safety cap. Ranks/averages over a partial set are
   * wrong, so the view must not present them as complete.
   */
  resultsTruncated?: boolean;
  onFilteredCountChange?: (count: number) => void;
  isColumnVisible?: (key: string) => boolean;
  columnCustomizer?: ModuleColumnCustomizerProps;
}

export interface RankedResult extends StudentResultItem {
  id: string;
  examId: string;
  studentId: string;
  marksObtained: number;
  /** 2-decimal and unrounded percentages from the shared scoring engine. */
  percentage: number;
  rawPercentage: number;
  effectiveMarks: number;
  /** Moderation adjustment; the effective score is `marksObtained + graceMarks`. */
  graceMarks?: number;
  moderationReason?: string | null;
  /** Exam-wide rank/position (competition ranking, ties share). */
  rank: number;
  position: number;
  /** Rank within the student's class — the "class position" printed on documents. */
  classRank: number;
  classPosition: number;
  classSize: number;
  overallSize: number;
  version?: number;
}

export interface ResultsViewStatsData {
  average: number;
  passed: number;
  failed: number;
  total: number;
}

export const RANK_ICONS = ["🥇", "🥈", "🥉"];

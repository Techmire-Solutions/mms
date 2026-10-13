import type { Exam, ExamResult } from "@/lib/data/examinationData";
import type { ModuleColumnCustomizerProps } from "@/components/app/ModuleColumnCustomizer";
import type { StudentResultItem } from "@/tenant/features/examinations/components/StudentResultCard";

export interface ResultsViewProps {
  exams: Exam[];
  results: ExamResult[];
  onFilteredCountChange?: (count: number) => void;
  isColumnVisible?: (key: string) => boolean;
  columnCustomizer?: ModuleColumnCustomizerProps;
}

export interface RankedResult extends StudentResultItem {
  id: string;
  examId: string;
  studentId: string;
  marksObtained: number;
}

export interface ResultsViewStatsData {
  average: number;
  passed: number;
  failed: number;
  total: number;
}

export const RANK_ICONS = ["🥇", "🥈", "🥉"];

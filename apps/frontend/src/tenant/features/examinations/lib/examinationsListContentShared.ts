import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { enrollmentHoldsSeat } from "@mms/shared";
import type { Enrollment } from "@/lib/data/enrollmentData";
import type { Exam } from "@/lib/data/examinationData";

export interface ExamClassOption {
  id: string;
  name: string;
}

export interface ExaminationsListContentProps {
  viewMode: WorkDirectoryViewMode;
  exams: Exam[];
  selectedIds: string[];
  isColumnVisible: (key: string) => boolean;
  classes: ExamClassOption[];
  enrollments: Enrollment[];
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  canTrashRows: boolean;
  statusConfig: Record<string, StatusBadgeConfigItem>;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  onEdit: (exam: Exam) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelectedExam: (id: string, checked: boolean) => void;
  onTrashAction: (id: string) => void;
  onRowClick?: (id: string) => void;
}

export function getExamMeta(
  exam: Exam,
  classes: ExamClassOption[],
  enrollments: Enrollment[],
): { assignedClasses: ExamClassOption[]; studentCount: number } {
  const classIdSet = new Set(exam.classIds);
  const assignedClasses = classes.filter((sessionClass) => classIdSet.has(sessionClass.id));
  const studentCount = new Set(
    enrollments
      .filter(
        (enrollment) =>
          classIdSet.has(enrollment.classId) &&
          enrollmentHoldsSeat(enrollment.status) &&
          enrollment.status !== "completed",
      )
      .map((enrollment) => String(enrollment.studentId)),
  ).size;
  return { assignedClasses, studentCount };
}

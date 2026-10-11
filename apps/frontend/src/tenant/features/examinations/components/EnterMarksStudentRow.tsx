import React from "react";
import { motion } from "framer-motion";
import { type Exam } from "@/lib/data/examinationData";
import type { Student } from "@/lib/data/studentsData";
import { getGrade } from "@/tenant/features/examinations/components/gradeUtils";
import { FORM_INPUT_COMPACT } from "@/components/ui/formStyles";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export interface EnterMarksStudentRowProps {
  student: Student & { classId: string; rollNo: string };
  index: number;
  exam: Exam;
  classNameText: string;
  markValue: number | string;
  onMarkChange: (studentId: string, value: string) => void;
}

export function EnterMarksStudentRow({
  student,
  index,
  exam,
  classNameText,
  markValue,
  onMarkChange,
}: EnterMarksStudentRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const numValue = Number(markValue);
  const isInvalid =
    markValue !== "" && (isNaN(numValue) || numValue < 0 || numValue > exam.totalMarks);
  const percentage =
    exam.totalMarks > 0 && markValue !== "" && !isInvalid
      ? Math.round((numValue / exam.totalMarks) * 100)
      : null;
  const grade = percentage !== null ? getGrade(percentage) : null;

  return (
    <motion.div
      key={student.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
      role="listitem"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatar id={student.id} name={student.name} size="sm" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {student.name ?? t("examinations.enterMarks.studentFallback")}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {classNameText} · {student.rollNo}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 self-end sm:self-auto">
        {grade && (
          <Badge as="span" tone={grade.tone ?? "primary"} pill size="sm" role="status">
            {grade.label} · {percentage}%
          </Badge>
        )}
        <div className="flex items-center gap-1.5">
          <Input
            id={`marks-${student.id}`}
            name={`marks_${student.id}`}
            type="text"
            inputMode="decimal"
            value={markValue}
            aria-label={t("examinations.enterMarks.marksInputAria", {
              name: student.name ?? t("examinations.enterMarks.studentLabel"),
            })}
            aria-invalid={isInvalid}
            onChange={(event) => onMarkChange(String(student.id), event.target.value)}
            className={cn(
              FORM_INPUT_COMPACT,
              "w-20 shrink-0 tabular-nums",
              isInvalid &&
                "border-destructive bg-destructive/10 text-destructive focus-visible:ring-destructive",
            )}
            placeholder="—"
          />
          <span className="text-xs text-muted-foreground shrink-0" aria-hidden="true">
            / {exam.totalMarks}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

import React from "react";
import { m } from "framer-motion";
import { type Exam } from "@/lib/data/examinationData";
import type { Student } from "@/lib/data/studentsData";
import { resolveResultScore } from "@mms/shared";
import { FORM_INPUT_COMPACT } from "@/components/ui/formStyles";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/app/UserAvatar";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export interface EnterMarksStudentRowProps {
  student: Student & { classId: string; rollNo: string };
  index: number;
  exam: Exam;
  classNameText: string;
  markValue: number | string;
  onMarkChange: (studentId: string, value: string) => void;
  /** Published results are immutable; the input is disabled so no edit is silently discarded. */
  readOnly?: boolean;
}

export const EnterMarksStudentRow = React.memo(function EnterMarksStudentRow({
  student,
  index,
  exam,
  classNameText,
  markValue,
  onMarkChange,
  readOnly = false,
  position,
  total,
}: EnterMarksStudentRowProps & { position?: number; total?: number }): React.JSX.Element {
  const { t } = useTranslation();
  const numValue = Number(markValue);
  const isInvalid =
    markValue !== "" && (isNaN(numValue) || numValue < 0 || numValue > exam.totalMarks);
  // Same scoring engine as the collections, the certificate and the printed card.
  const score =
    markValue !== "" && !isInvalid
      ? resolveResultScore({
          marksObtained: numValue,
          totalMarks: exam.totalMarks,
          passingMarks: exam.passingMarks,
        })
      : null;
  const percentage = score?.displayPercentage ?? null;
  const grade = score?.grade ?? null;
  const errorId = `marks-error-${student.id}`;

  return (
    <m.div
      key={student.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
      role="listitem"
      aria-posinset={position != null ? position + 1 : undefined}
      aria-setsize={total}
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
            dir="ltr"
            disabled={readOnly}
            value={markValue}
            aria-label={t("examinations.enterMarks.marksInputAria", {
              name: student.name ?? t("examinations.enterMarks.studentLabel"),
            })}
            aria-invalid={isInvalid}
            aria-describedby={isInvalid ? errorId : undefined}
            data-marks-input
            data-marks-index={index}
            onChange={(event) => onMarkChange(String(student.id), event.target.value)}
            className={cn(
              FORM_INPUT_COMPACT,
              "w-20 shrink-0 text-end tabular-nums",
              isInvalid &&
                "border-destructive bg-destructive/10 text-destructive focus-visible:ring-destructive",
            )}
            placeholder="—"
          />
          <span className="text-xs text-muted-foreground shrink-0" aria-hidden="true">
            / {exam.totalMarks}
          </span>
          {isInvalid && (
            <span id={errorId} className="text-xs font-semibold text-destructive">
              {t("examinations.enterMarks.invalidMark", { max: exam.totalMarks })}
            </span>
          )}
        </div>
      </div>
    </m.div>
  );
});

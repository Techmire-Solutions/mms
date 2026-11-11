import React from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { Exam } from "@/lib/data/examinationData";

export interface EnterMarksExamSelectorProps {
  exams: Exam[];
  selectedExam: string;
  isDirty: boolean;
  onSelect: (examId: string) => void;
}

/** Exam radio group for the marks modal; switching exams with a dirty draft asks first. */
export function EnterMarksExamSelector({
  exams,
  selectedExam,
  isDirty,
  onSelect,
}: EnterMarksExamSelectorProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div>
      <span
        id="enter-marks-title"
        className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block"
      >
        {t("examinations.selectExam")}
      </span>
      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label={t("examinations.enterMarks.selectExamAria")}
      >
        {exams.map((examOption) => {
          const isSelected = selectedExam === examOption.id;
          return (
            <Button
              key={examOption.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => {
                if (isDirty && !window.confirm(t("examinations.enterMarks.unsavedConfirm"))) {
                  return;
                }
                onSelect(examOption.id);
              }}
              className={cn(
                "px-3.5 py-2 rounded-lg border text-sm font-semibold transition-all",
                isSelected
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card hover:bg-muted text-foreground",
              )}
            >
              {examOption.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

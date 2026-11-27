import React from "react";
import { useTranslation } from "@mms/fe-core/i18n";
import { type Exam } from "@mms/contracts";

/** Read-only exam header strip: subject, total marks, passing marks, student count. */
export function EnterMarksExamSummary({
  exam,
  studentsCount,
}: {
  exam: Exam;
  studentsCount: number;
}): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex flex-wrap gap-4 text-sm"
      role="status"
      aria-label={t("examinations.enterMarks.examDetailsAria")}
    >
      <span>
        <strong className="text-foreground">{exam.subject}</strong>
      </span>
      <span className="text-muted-foreground">
        {t("examinations.enterMarks.totalLabel")}:{" "}
        <strong className="text-foreground">{exam.totalMarks}</strong>
      </span>
      <span className="text-muted-foreground">
        {t("examinations.enterMarks.passingLabel")}:{" "}
        <strong className="text-foreground">{exam.passingMarks}</strong>
      </span>
      <span className="text-muted-foreground">
        {t("examinations.stats.students")}:{" "}
        <strong className="text-foreground">{studentsCount}</strong>
      </span>
    </div>
  );
}

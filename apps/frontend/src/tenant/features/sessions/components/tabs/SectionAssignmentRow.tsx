import React, { useState } from "react";
import { formatDate, todayISO } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/app/DatePicker";
import { useTranslation } from "@/hooks/useTranslation";

export interface SectionAssignmentRowProps {
  assignment: {
    id: string;
    startOn: string;
    endOn: string | null;
    /** Person shown (teacher or student). */
    facultyName?: string;
    studentName?: string;
    role: string;
    subjectName?: string | null;
    changeReason?: string | null;
  };
  /** Role label resolver; defaults to staff role labels. */
  roleLabel?: (role: string) => string;
  pending?: boolean;
  /** Present for open (current) rows only. */
  onEnd?: (endOn: string) => void;
}

/** One effective-dated row: who, role, period, reason, and an inline "end on" control. */
export function SectionAssignmentRow({
  assignment,
  roleLabel,
  pending = false,
  onEnd,
}: SectionAssignmentRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const [ending, setEnding] = useState(false);
  const [endOn, setEndOn] = useState(todayISO());
  const label = roleLabel
    ? roleLabel(assignment.role)
    : t(
        `sessions.staff.role.${assignment.role as "class_teacher" | "subject_teacher" | "assistant"}`,
      );
  const period = t("sessions.staff.period", {
    from: formatDate(assignment.startOn),
    to: assignment.endOn ? formatDate(assignment.endOn) : t("sessions.staff.present"),
  });

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{assignment.facultyName ?? assignment.studentName}</p>
        <p className="text-xs text-muted-foreground">
          {label}
          {assignment.subjectName ? ` · ${assignment.subjectName}` : ""} · {period}
          {assignment.changeReason ? ` · ${assignment.changeReason}` : ""}
        </p>
      </div>
      {onEnd && !ending ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() => setEnding(true)}
        >
          {t("sessions.staff.end")}
        </Button>
      ) : null}
      {onEnd && ending ? (
        <div className="flex items-center gap-2">
          <DatePicker
            id={`end-${assignment.id}`}
            aria-label={t("sessions.staff.endOn")}
            value={endOn}
            min={assignment.startOn}
            onChange={setEndOn}
          />
          <Button
            type="button"
            size="sm"
            className="min-h-11"
            disabled={pending || !endOn}
            onClick={() => {
              onEnd(endOn);
              setEnding(false);
            }}
          >
            {t("sessions.staff.end")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11"
            onClick={() => setEnding(false)}
          >
            {t("common.cancel")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

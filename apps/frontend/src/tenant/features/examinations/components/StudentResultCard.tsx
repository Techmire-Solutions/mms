import React from "react";
import { Award, Printer } from "lucide-react";
import { getRankSuffix, type GradeInfo } from "@/tenant/features/examinations/lib/gradeUtils";
import { type Exam } from "@/lib/data/examinationData";
import { formatDate } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/app/Modal";
import { Card } from "@/components/ui/card";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { CARD_STRIPE_INSET, SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

export interface StudentResultItem {
  pct: number;
  grade: GradeInfo;
  rank: number;
  marksObtained: number;
  passed: boolean;
  student?: {
    name: string;
    rollNo: string;
  };
  cls?: {
    name: string;
  };
}

export interface StudentResultCardProps {
  result: StudentResultItem;
  exam: Exam;
  allResults: StudentResultItem[]; // accepts array of results context
  onClose: () => void;
  onCertificate: () => void;
}

/**
 * Dialog card modal showcasing individual student examination status and grading results.
 *
 * @param props - Component props.
 * @param props.result - Computed result details for selected student.
 * @param props.exam - Exam paper configuration metadata.
 * @param props.allResults - All results evaluated in class.
 * @param props.onClose - Action to dismiss card.
 * @param props.onCertificate - Trigger graduation certificate view.
 * @returns The StudentResultCard component.
 */
export function StudentResultCard({
  result,
  exam,
  allResults,
  onClose,
  onCertificate,
}: StudentResultCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const percentage = result.pct;
  const grade = result.grade;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (percentage / 100) * circumference;

  const position = result.rank;
  const total = allResults.length;
  const passFailConfig = (() => ({
    pass: { label: t("examinations.pass"), cls: SEMANTIC_BADGE.success },
    fail: { label: t("examinations.fail"), cls: SEMANTIC_BADGE.destructive },
  }))() as Record<string, StatusBadgeConfigItem>;

  return (
    <Modal
      open
      onClose={onClose}
      title={result.student?.name || t("examinations.resultCard.title")}
      subtitle={`${result.cls?.name || ""} · ${result.student?.rollNo || ""}`}
      icon={Award}
      size="sm"
      footer={
        <div className="flex gap-2.5 w-full">
          {result.passed && (
            <Button
              type="button"
              onClick={onCertificate}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-warning/40 bg-warning/10 text-warning text-sm font-semibold hover:bg-warning/15"
            >
              <Award className="w-4 h-4" aria-hidden="true" />{" "}
              {t("examinations.resultCard.certificate")}
            </Button>
          )}
          <Button
            type="button"
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-muted text-foreground text-sm font-semibold hover:bg-muted/80"
          >
            <Printer className="w-4 h-4" aria-hidden="true" /> {t("examinations.resultCard.print")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Circular progress */}
        <div className="p-4 rounded-xl border border-border bg-muted/20 text-center relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{ background: `linear-gradient(135deg, ${grade.bg}, transparent)` }}
          />
          <div className="relative w-28 h-28 mx-auto" aria-hidden="true">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={grade.color}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: grade.color }}>
                {grade.label}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">{percentage}%</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div
          className="grid grid-cols-1 divide-y divide-border border-t border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:rtl:divide-x-reverse"
          role="status"
          aria-label={t("examinations.resultCard.metricsAria")}
        >
          <div className="min-w-0 px-2 py-3.5 text-center sm:px-3">
            <p className="text-sm font-bold text-foreground break-words">{`${result.marksObtained}/${exam.totalMarks}`}</p>
            <p className="text-xs text-muted-foreground">{t("examinations.resultCard.marks")}</p>
          </div>
          <div className="min-w-0 px-2 py-3.5 text-center sm:px-3">
            <p className="text-sm font-bold text-foreground break-words">
              {getRankSuffix(position)} / {total}
            </p>
            <p className="text-xs text-muted-foreground">{t("examinations.resultCard.rank")}</p>
          </div>
          <div className="min-w-0 px-2 py-3.5 text-center flex flex-col items-center gap-1 sm:px-3">
            <StatusBadge
              status={result.passed ? "pass" : "fail"}
              config={passFailConfig}
              size="sm"
            />
            <p className="text-xs text-muted-foreground">{t("examinations.resultCard.status")}</p>
          </div>
        </div>

        {/* Exam info */}
        <Card
          accentColor="primary"
          className={cn("p-4 space-y-2 text-sm text-muted-foreground", CARD_STRIPE_INSET)}
          aria-label={t("examinations.resultCard.examDetailsAria")}
        >
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>{t("examinations.resultCard.exam")}</span>
              <span className="font-semibold text-foreground">{exam.name}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("examinations.resultCard.subject")}</span>
              <span className="font-semibold text-foreground">{exam.subject}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("examinations.resultCard.date")}</span>
              <span className="font-semibold text-foreground">{formatDate(exam.date, true)}</span>
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  );
}

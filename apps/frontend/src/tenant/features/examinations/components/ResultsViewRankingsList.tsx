import React from "react";
import { motion } from "framer-motion";
import { Trophy, Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { getInitials } from "@mms/shared";
import { CARD_STRIPE_INSET } from "@/lib/semanticTone";
import { cn } from "@/lib/utils";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { Exam } from "@/lib/data/examinationData";
import {
  RANK_ICONS,
  type RankedResult,
} from "@/tenant/features/examinations/components/resultsViewTypes";

export interface ResultsViewRankingsListProps {
  exam: Exam;
  rankedResults: RankedResult[];
  passFailConfig: Record<string, StatusBadgeConfigItem>;
  isColumnVisible: (key: string) => boolean;
  onSelectResult: (result: RankedResult) => void;
  onCertificate: (result: RankedResult) => void;
  t: TranslationFunction;
}

export function ResultsViewRankingsList({
  exam,
  rankedResults,
  passFailConfig,
  isColumnVisible,
  onSelectResult,
  onCertificate,
  t,
}: ResultsViewRankingsListProps): React.JSX.Element {
  const showStudent = isColumnVisible("student");
  const showClassRoll = isColumnVisible("classRoll");
  const showMarks = isColumnVisible("marks");
  const showPercentage = isColumnVisible("percentage");

  return (
    <Card
      accentColor="warning"
      className="p-0 overflow-hidden"
      aria-label={t("examinations.rankings")}
    >
      <div
        className={cn(
          "px-4 py-3 border-b border-border/40 flex min-w-0 items-center gap-2 bg-muted/20",
          CARD_STRIPE_INSET,
        )}
      >
        <Trophy className="w-4 h-4 shrink-0 text-warning" aria-hidden="true" />
        <h3 className="min-w-0 truncate text-sm font-bold text-foreground m-0">
          {t("examinations.rankingsTitle", { name: exam.name })}
        </h3>
      </div>
      {rankedResults.length === 0 ? (
        <EmptyState variant="dashed" title={t("examinations.empty.results")} compact />
      ) : (
        <div className={cn("divide-y divide-border/50", CARD_STRIPE_INSET)} role="list">
          {rankedResults.map((rankedResult) => (
            <motion.div
              key={rankedResult.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer flex-wrap"
              onClick={() => onSelectResult(rankedResult)}
              role="listitem"
              aria-label={t("examinations.viewResultAria", {
                name: rankedResult.student?.name || t("examinations.columns.results.student"),
              })}
            >
              {isColumnVisible("rank") && (
                <div className="w-8 text-center flex-shrink-0">
                  {rankedResult.rank <= 3 ? (
                    <span
                      className="text-lg"
                      aria-label={t("examinations.rankLabel", { rank: rankedResult.rank })}
                    >
                      {RANK_ICONS[rankedResult.rank - 1]}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">
                      {t("examinations.rankLabel", { rank: rankedResult.rank })}
                    </span>
                  )}
                </div>
              )}

              {showStudent && (
                <>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                    style={{ background: rankedResult.grade.color }}
                    aria-hidden="true"
                  >
                    {rankedResult.student?.name ? getInitials(rankedResult.student.name) : "S"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground m-0">
                      {rankedResult.student?.name}
                    </p>
                    {showClassRoll && (
                      <p className="text-xs text-muted-foreground m-0">
                        {rankedResult.cls?.name} · {rankedResult.student?.rollNo}
                      </p>
                    )}
                  </div>
                </>
              )}

              {!showStudent && showClassRoll && (
                <div className="flex-1 min-w-0 text-sm text-muted-foreground">
                  {rankedResult.cls?.name} · {rankedResult.student?.rollNo}
                </div>
              )}

              {showMarks && (
                <div className="text-end flex-shrink-0">
                  <p className="text-sm font-bold text-foreground m-0">
                    {rankedResult.marksObtained}
                    <span className="text-xs font-normal text-muted-foreground">
                      /{exam.totalMarks}
                    </span>
                  </p>
                  {showPercentage && (
                    <p className="text-xs text-muted-foreground m-0">{rankedResult.pct}%</p>
                  )}
                </div>
              )}

              {!showMarks && showPercentage && (
                <div className="text-end flex-shrink-0 text-sm text-muted-foreground">
                  {rankedResult.pct}%
                </div>
              )}

              {isColumnVisible("grade") && (
                <span
                  className="text-sm font-bold px-2.5 py-1 rounded-lg flex-shrink-0"
                  style={{
                    color: rankedResult.grade.color,
                    background: rankedResult.grade.bg,
                    border: `1px solid ${rankedResult.grade.border}`,
                  }}
                >
                  {rankedResult.grade.label}
                </span>
              )}

              {isColumnVisible("passFail") && (
                <StatusBadge
                  status={rankedResult.passed ? "pass" : "fail"}
                  config={passFailConfig}
                  size="sm"
                />
              )}

              {rankedResult.passed && rankedResult.rank <= 3 && (
                <Button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCertificate(rankedResult);
                  }}
                  className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-warning/10 text-warning hover:bg-warning/15 transition-colors flex-shrink-0"
                >
                  <Award className="w-3 h-3" aria-hidden="true" /> {t("examinations.certificate")}
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  );
}

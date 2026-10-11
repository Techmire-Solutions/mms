import React from "react";
import { FileText } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { type QuestionBankTest, formatDate } from "@mms/shared";

interface SavedPapersPanelProps {
  activePaperId: string | null;
  papers: QuestionBankTest[];
  onOpenPaper: (paper: QuestionBankTest) => void;
}

function formatPaperDate(value: string): string {
  return formatDate(value);
}

export function SavedPapersPanel({
  activePaperId,
  papers,
  onOpenPaper,
}: SavedPapersPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const sortedPapers = [...papers].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );

  return (
    <section className={`${WORK_SURFACE} p-4`} aria-label={t("questionBank.savedPapers")}>
      <div className="mb-3">
        <h3 className="m-0 text-sm font-bold text-foreground">{t("questionBank.savedPapers")}</h3>
        <p className="m-0 text-xs text-muted-foreground">{t("questionBank.savedPapersDesc")}</p>
      </div>

      {sortedPapers.length === 0 ? (
        <EmptyState
          title={t("questionBank.noSavedPapers")}
          variant="dashed"
          compact
          icon={null}
          className="rounded-lg"
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {sortedPapers.map((paper) => {
            const isActive = paper.id === activePaperId;
            return (
              <div
                key={paper.id}
                className={`rounded-lg border p-3 ${isActive ? "border-primary bg-primary/5" : "border-border bg-muted/20"}`}
              >
                <div className="mb-3 flex items-start gap-2">
                  <FileText
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-xs font-bold text-foreground">{paper.name}</p>
                    <p className="m-0 text-xs text-muted-foreground">
                      {t("questionBank.paperQuestionSummary", { count: paper.questionIds.length })}
                    </p>
                    <p className="m-0 text-xs text-muted-foreground">
                      {t("questionBank.paperCreatedOn", { date: formatPaperDate(paper.createdAt) })}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  onClick={() => onOpenPaper(paper)}
                >
                  {isActive ? t("questionBank.paperOpened") : t("questionBank.openPaper")}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

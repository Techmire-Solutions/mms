import React, { useState } from "react";
import { Printer, Save } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { PrintablePaper } from "@/tenant/features/question-bank/components/PrintablePaper";
import { PrintableAnswerSheet } from "@/tenant/features/question-bank/components/PrintableAnswerSheet";
import type { QuestionBankQuestion as Question } from "@mms/shared";
import type {
  PaperConfig,
  PaperPrintMode,
  PaperSection,
} from "@/tenant/features/question-bank/lib/paperBuilderUtils";

interface PaperPreviewPanelProps {
  config: PaperConfig;
  printRef: React.RefObject<HTMLDivElement | null>;
  questionsById: Map<string, Question>;
  sections: PaperSection[];
  selectedCount: number;
  saving: boolean;
  /** Answer-key/sheet views expose the stored answer, so they follow the write permission. */
  canViewAnswers?: boolean;
  onPrint: () => void;
  onSave: () => void;
}

export function PaperPreviewPanel({
  config,
  printRef,
  questionsById,
  sections,
  selectedCount,
  saving,
  canViewAnswers = false,
  onPrint,
  onSave,
}: PaperPreviewPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const [mode, setMode] = useState<PaperPrintMode>("paper");
  const effectiveMode: PaperPrintMode = canViewAnswers ? mode : "paper";
  const modeOptions: Array<{ value: PaperPrintMode; label: string }> = [
    { value: "paper", label: t("questionBank.paperView") },
    { value: "answerKey", label: t("questionBank.answerKey") },
    { value: "answerSheet", label: t("questionBank.answerSheet") },
  ];

  return (
    <section
      className="rounded-xl border border-border bg-muted/20 p-3 sm:p-4"
      aria-label={t("questionBank.paperPreview")}
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="m-0 text-sm font-bold text-foreground">
            {t("questionBank.paperPreview")}
          </h3>
          <p className="m-0 text-xs text-muted-foreground">{t("questionBank.paperPreviewDesc")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {canViewAnswers && (
            <div className="flex overflow-hidden rounded-md border border-border" role="group">
              {modeOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={effectiveMode === option.value ? "default" : "ghost"}
                  className="rounded-none"
                  aria-pressed={effectiveMode === option.value}
                  onClick={() => setMode(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}
          <Button
            type="button"
            onClick={onSave}
            disabled={selectedCount === 0 || saving}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            {t("questionBank.saveTest")}
          </Button>
          <Button
            type="button"
            onClick={onPrint}
            disabled={selectedCount === 0}
            size="sm"
            className="w-full sm:w-auto"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            {t("questionBank.printPaper")}
          </Button>
        </div>
      </div>
      <div className="max-h-preview-lg overflow-auto rounded-lg border border-border bg-card p-2 sm:max-h-preview-2xl sm:p-3">
        <div
          ref={printRef}
          className="origin-top-left rtl:origin-top-right scale-preview-xs sm:scale-preview-sm md:scale-preview-md lg:scale-preview-lg"
          style={{
            width: "210mm",
            minHeight: "297mm",
          }}
        >
          {effectiveMode === "answerSheet" ? (
            <PrintableAnswerSheet
              config={config}
              sections={sections}
              questionsById={questionsById}
            />
          ) : (
            <PrintablePaper
              config={config}
              sections={sections}
              questionsById={questionsById}
              mode={effectiveMode}
            />
          )}
        </div>
      </div>
    </section>
  );
}

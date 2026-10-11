import React from "react";
import type {
  QuestionDifficultyRegistryEntry,
  QuestionTypeRegistryEntry,
  AppTranslationKey,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { cn } from "@/lib/utils";

export interface QuestionBankTaxonomySectionProps {
  questionTypes?: QuestionTypeRegistryEntry[];
  difficultyLevels?: QuestionDifficultyRegistryEntry[];
  onToggleQuestionType: (id: string) => void;
  onToggleDifficulty: (id: string) => void;
}

export function QuestionBankTaxonomySection({
  questionTypes = [],
  difficultyLevels = [],
  onToggleQuestionType,
  onToggleDifficulty,
}: QuestionBankTaxonomySectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 border-t border-border/60 pt-3">
      <div className="space-y-2">
        <SectionLabel as="h4" weight="bold" tracking="wide">
          {t("questionBank.typesTitle")}
        </SectionLabel>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t("questionBank.typesTitle")}
        >
          {questionTypes.map((entry) => (
            <Button
              key={entry.id}
              type="button"
              variant="outline"
              aria-pressed={entry.enabled}
              onClick={() => onToggleQuestionType(entry.id)}
              className={cn(
                "rounded-full border px-3 text-xs font-semibold transition-colors min-h-11",
                entry.enabled
                  ? "border-primary bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {t(`questionBank.type.${entry.id}` as AppTranslationKey)}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <SectionLabel as="h4" weight="bold" tracking="wide">
          {t("questionBank.difficultiesTitle")}
        </SectionLabel>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t("questionBank.difficultiesTitle")}
        >
          {difficultyLevels.map((entry) => (
            <Button
              key={entry.id}
              type="button"
              variant="outline"
              aria-pressed={entry.enabled}
              onClick={() => onToggleDifficulty(entry.id)}
              className={cn(
                "rounded-full border px-3 text-xs font-semibold transition-colors min-h-11",
                entry.enabled
                  ? "border-primary bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {t(`questionBank.difficulty.${entry.id}` as AppTranslationKey)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

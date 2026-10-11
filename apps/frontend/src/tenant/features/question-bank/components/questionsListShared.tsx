import type { ReactNode } from "react";
import { getQuestionCategoryIds, QUESTION_SOURCE_FIELD_IDS } from "@mms/shared";
import { CategoryColorChip } from "@/tenant/features/question-bank/components/CategoryColorChip";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { Badge } from "@/components/ui/badge";
import type { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import type { QuestionBankQuestion as Question } from "@mms/shared";

type QuestionBankConfig = ReturnType<typeof useQuestionBankConfig>;

export const SYSTEM_FIELD_IDS = new Set([
  "text",
  "categoryId",
  "questionLanguage",
  "type",
  "difficulty",
  "options",
  "answer",
  ...QUESTION_SOURCE_FIELD_IDS,
]);

export function renderQuestionMetaChip(
  question: Question,
  fieldId: string,
  config: QuestionBankConfig,
  difficultyConfig: Record<string, StatusBadgeConfigItem>,
  typeConfig: Record<string, StatusBadgeConfigItem>,
): ReactNode {
  const getCategory = (id: string) => config.categories.find((category) => category.id === id);

  if (fieldId === "categoryId") {
    return getQuestionCategoryIds(question).map((categoryId) => {
      const category = getCategory(categoryId);
      if (!category) return null;
      return (
        <CategoryColorChip
          key={categoryId}
          name={category.name}
          color={category.color}
          icon={category.icon}
        />
      );
    });
  }
  if (fieldId === "questionLanguage") {
    return (
      <Badge
        key="questionLanguage"
        pill
        variant="outline"
        className="px-2 font-bold bg-muted text-foreground"
      >
        {config.questionLanguageLabel(question.questionLanguage)}
      </Badge>
    );
  }
  if (fieldId === "difficulty") {
    return (
      <StatusBadge
        key="difficulty"
        status={question.difficulty}
        config={difficultyConfig}
        size="sm"
      />
    );
  }
  if (fieldId === "type") {
    return <StatusBadge key="type" status={question.type} config={typeConfig} size="sm" />;
  }
  return null;
}

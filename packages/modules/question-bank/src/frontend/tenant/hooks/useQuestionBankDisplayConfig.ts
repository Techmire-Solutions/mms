import { useMemo } from "react";
import {
  QUESTION_TYPE_ICONS,
  isQuestionSourceFieldId,
  type QuestionBankQuestion,
} from "@mms/contracts";
import { SEMANTIC_BADGE } from "@mms/fe-core/ui/semanticTone";
import type { useQuestionBankConfig } from "./useQuestionBankConfig";

type QuestionBankConfig = ReturnType<typeof useQuestionBankConfig>;
import type { StatusBadgeConfigItem } from "@mms/fe-core/components/StatusBadge";

export function useQuestionBankDisplayConfig(config: QuestionBankConfig) {
  const { difficultyLabel, typeLabel } = config;

  // Stable identities: QuestionsListDesktopTable memoizes its columns (and therefore
  // the StatusBadge configs baked into the column render callbacks) on these values.
  const difficultyConfig = useMemo(
    () =>
      ({
        easy: { label: difficultyLabel("easy"), cls: SEMANTIC_BADGE.success },
        medium: { label: difficultyLabel("medium"), cls: SEMANTIC_BADGE.warning },
        hard: { label: difficultyLabel("hard"), cls: SEMANTIC_BADGE.destructive },
      }) as Record<string, StatusBadgeConfigItem>,
    [difficultyLabel],
  );

  const typeConfig = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(QUESTION_TYPE_ICONS).map((typeId: any) => [
          typeId,
          {
            label: `${QUESTION_TYPE_ICONS[typeId as keyof typeof QUESTION_TYPE_ICONS]} ${typeLabel(typeId)}`,
            cls: SEMANTIC_BADGE.muted,
          },
        ]),
      ) as Record<string, StatusBadgeConfigItem>,
    [typeLabel],
  );

  return { difficultyConfig, typeConfig };
}

export function buildQuestionsListMetaFields(
  config: QuestionBankConfig,
  isColumnVisible?: (key: string) => boolean,
) {
  return config.orderedFields.filter((field: any) => {
    if (!config.isFieldEnabled(field.id)) return false;
    const colKey =
      field.id === "categoryId"
        ? "category"
        : field.id === "questionLanguage"
          ? "language"
          : field.id;
    return isColumnVisible ? isColumnVisible(colKey) : true;
  });
}

export function shouldShowQuestionSourceCitation(
  config: QuestionBankConfig,
  showSource: boolean,
): boolean {
  return (
    showSource &&
    config.orderedFields.some(
      (field: any) => isQuestionSourceFieldId(field.id) && config.isFieldEnabled(field.id),
    )
  );
}

export type { QuestionBankQuestion };

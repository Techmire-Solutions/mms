import React from "react";
import { FileQuestion } from "lucide-react";
import type { QuestionBankQuestion as Question } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import {
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
} from "@/components/app/DetailDrawerArchiveChrome";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";
import { CategoryColorChip } from "@/tenant/features/question-bank/components/CategoryColorChip";
import type { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";

export interface QuestionBankDetailProps {
  question: Question;
  config: ReturnType<typeof useQuestionBankConfig>;
  onClose: () => void;
  onEdit?: (question: Question) => void;
  canDelete?: boolean;
  onRestore?: (questionId: string) => void | Promise<void>;
}

export const QuestionBankDetail = function QuestionBankDetail({
  question,
  config,
  onClose,
  onEdit,
  canDelete = false,
  onRestore,
}: QuestionBankDetailProps) {
  const { t } = useTranslation();
  const isArchived = !!question.deletedAt;

  return (
    <DetailDrawerShell
      open
      onClose={onClose}
      title={t("questionBank.detail.title")}
      subtitle={question.type}
      icon={FileQuestion}
      headerExtra={isArchived && <DetailDrawerArchivedBanner deletedAt={question.deletedAt} />}
      headerActions={
        <DetailDrawerRestoreOrEditAction
          isArchived={isArchived}
          canEdit={!!onEdit}
          canRestore={canDelete}
          onEdit={() => onEdit?.(question)}
          onRestore={() => onRestore?.(question.id)}
          restoreLabel={t("common.restore")}
          editLabel={t("common.edit")}
        />
      }
    >
      <div className="flex flex-col gap-6 py-6">
        <DetailSectionCard
          title={t("questionBank.detail.overview")}
          className="overflow-hidden divide-y divide-border"
        >
          <DetailAttributeRow
            label={t("questionBank.fields.type")}
            value={config.typeLabel?.(question.type) || question.type}
          />
          <DetailAttributeRow
            label={t("questionBank.fields.difficulty")}
            value={config.difficultyLabel?.(question.difficulty) || question.difficulty}
          />
          <DetailAttributeRow
            label={t("questionBank.fields.category")}
            value={
              <div className="flex flex-wrap gap-1">
                {question.categoryIds?.map((catId) => (
                  <CategoryColorChip
                    key={catId}
                    name={config.categories.find((c) => c.id === catId)?.name || catId}
                    color={
                      config.categories.find((c) => c.id === catId)?.color ||
                      "hsl(var(--muted-foreground))"
                    }
                  />
                ))}
              </div>
            }
          />
          <DetailAttributeRow label={t("questionBank.fields.marks")} value={question.marks ?? 1} />
        </DetailSectionCard>

        <DetailSectionCard title={t("questionBank.fields.content")} className="p-4">
          <div className="whitespace-pre-line text-sm text-foreground">{question.text}</div>
        </DetailSectionCard>

        {question.answer && (
          <DetailSectionCard title={t("questionBank.fields.explanation")} className="p-4">
            <div className="whitespace-pre-line text-sm text-foreground">{question.answer}</div>
          </DetailSectionCard>
        )}
      </div>
    </DetailDrawerShell>
  );
};

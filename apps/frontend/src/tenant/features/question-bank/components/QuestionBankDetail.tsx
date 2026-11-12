import React from "react";
import { FileQuestion } from "lucide-react";
import type { QuestionBankQuestion as Question, QuestionStatus } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import {
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
} from "@/components/app/DetailDrawerArchiveChrome";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";
import { CategoryColorChip } from "@/tenant/features/question-bank/components/CategoryColorChip";
import { QuestionMediaSection } from "@/tenant/features/question-bank/components/QuestionMediaSection";
import type { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";

export interface QuestionBankDetailProps {
  question: Question;
  config: ReturnType<typeof useQuestionBankConfig>;
  onClose: () => void;
  onEdit?: (question: Question) => void;
  canDelete?: boolean;
  canWrite?: boolean;
  /** Approve/retire needs `questionBank.delete` (approver authority, round-5 API gate). */
  canApprove?: boolean;
  onRestore?: (questionId: string) => void | Promise<void>;
  /** Lifecycle action (0241): submit / approve / reopen / retire. */
  onSetStatus?: (question: Question, status: QuestionStatus) => void | Promise<void>;
  /** Clone as a new draft revision — the sanctioned path when an edit is refused. */
  onDuplicate?: (question: Question) => void | Promise<void>;
}

export const QuestionBankDetail = function QuestionBankDetail({
  question,
  config,
  onClose,
  onEdit,
  canDelete = false,
  canWrite = false,
  canApprove = false,
  onRestore,
  onSetStatus,
  onDuplicate,
}: QuestionBankDetailProps) {
  const { t } = useTranslation();
  const isArchived = !!question.deletedAt;
  const status = question.status ?? "draft";

  // Lifecycle actions available from this state; nothing is offered on an archived question or to a
  // caller without approver authority (the API rejects approve/retire with 403).
  const lifecycleActions: { status: QuestionStatus; labelKey: string; primary?: boolean }[] =
    isArchived || !onSetStatus
      ? []
      : status === "draft"
        ? [{ status: "under_review", labelKey: "questionBank.action.submitReview", primary: true }]
        : status === "under_review"
          ? [
              ...(canApprove
                ? [
                    {
                      status: "approved" as QuestionStatus,
                      labelKey: "questionBank.action.approve",
                      primary: true,
                    },
                  ]
                : []),
              { status: "draft", labelKey: "questionBank.action.reopen" },
            ]
          : status === "approved"
            ? canApprove
              ? [{ status: "retired", labelKey: "questionBank.action.retire" }]
              : []
            : [{ status: "draft", labelKey: "questionBank.action.reopen", primary: true }];

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
          <DetailAttributeRow
            label={t("questionBank.status")}
            value={t(`questionBank.status.${status}` as never)}
          />
        </DetailSectionCard>

        {(lifecycleActions.length > 0 || onDuplicate) && (
          <DetailSectionCard title={t("questionBank.status")} className="flex flex-wrap gap-2 p-4">
            {lifecycleActions.map((action) => (
              <Button
                key={action.status}
                type="button"
                size="sm"
                variant={action.primary ? "default" : "outline"}
                onClick={() => void onSetStatus?.(question, action.status)}
              >
                {t(action.labelKey as never)}
              </Button>
            ))}
            {onDuplicate && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void onDuplicate?.(question)}
              >
                {t("questionBank.action.duplicate")}
              </Button>
            )}
          </DetailSectionCard>
        )}

        <DetailSectionCard title={t("questionBank.fields.content")} className="p-4">
          <div className="whitespace-pre-line text-sm text-foreground">{question.text}</div>
        </DetailSectionCard>

        <DetailSectionCard title={t("questionBank.mediaTitle")} className="p-4">
          <QuestionMediaSection question={question} canWrite={canWrite} />
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
